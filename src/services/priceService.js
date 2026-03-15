const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CACHE_DURATION = 35 * 60 * 1000; // 35 min — slightly more than the 30-min snapshot interval
// Per-coin in-memory cache: cacheKey -> { price, fetchedAt }
const cryptoPriceCache = new Map();
// Per-metal in-memory cache (same TTL as crypto)
const metalPriceCache = new Map();
// Exchange rate in-memory cache (30 min TTL — Frankfurter updates daily so this is fine)
const exchangeRateCache = new Map();
const EXCHANGE_RATE_TTL = 30 * 60 * 1000;
// CS2 skin prices: one bulk fetch for ALL items, cached in memory
// Source: market.csgo.com public price list (free, no API key, ~24k items, updated frequently)
const CS2_BULK_URL = 'https://market.csgo.com/api/v2/prices/USD.json';
let cs2BulkPricesMap = null;   // Map<marketHashName, priceUSD>
let cs2BulkFetchedAt = 0;
// Per-skin result cache (after conversion to target currency)
const cs2SkinPriceCache = new Map();
// Dedup map: prevents concurrent requests from firing multiple CoinGecko batch calls
const pendingPrefetches = new Map();

async function getCurrentPrice(asset, currency = 'EUR', force = false) {
  if (!force) {
    const cached = await prisma.priceCache.findFirst({
      where: {
        assetId: asset.id,
        currency,
        timestamp: { gte: new Date(Date.now() - CACHE_DURATION) },
        price: { gt: 0 }
      },
      orderBy: { timestamp: 'desc' }
    });

    if (cached) {
      console.log(`Cache hit for ${asset.symbol} in ${currency}: ${cached.price}`);
      return parseFloat(cached.price);
    }
  }

  console.log(`Fetching price for ${asset.symbol} in ${currency}`);
  let price;
  switch (asset.type) {
    case 'crypto':
      price = await getCryptoPrice(asset.symbol, currency);
      break;
    case 'stock':
    case 'etf':
      price = await getStockPrice(asset.symbol, currency);
      break;
    case 'metal':
      price = await getMetalPrice(asset.symbol, currency);
      break;
    case 'cash':
      price = await getExchangeRate(asset.symbol, currency);
      break;
    case 'cs2skin':
      price = await getCS2SkinPrice(asset.symbol, currency);
      break;
    default:
      price = 0;
  }

  if (price > 0) {
    await prisma.priceCache.create({
      data: { assetId: asset.id, price, currency }
    });
    console.log(`Cached price for ${asset.symbol} in ${currency}: ${price}`);
  } else {
    // API failed — fall back to the most recent cached price (even if stale)
    const stale = await prisma.priceCache.findFirst({
      where: { assetId: asset.id, currency, price: { gt: 0 } },
      orderBy: { timestamp: 'desc' }
    });
    if (stale) {
      console.warn(`Using stale cache for ${asset.symbol} (API returned 0): ${stale.price}`);
      return parseFloat(stale.price);
    }
  }

  return price;
}

async function getCryptoPrice(symbol, currency = 'EUR') {
  try {
    const coinId = getCoinGeckoId(symbol);
    const cacheKey = `${coinId}-${currency}`;
    const now = Date.now();

    // Per-coin in-memory cache (5 min TTL)
    const cached = cryptoPriceCache.get(cacheKey);
    if (cached && (now - cached.fetchedAt) < CACHE_DURATION) {
      console.log(`Memory cache hit for ${symbol}`);
      return cached.price;
    }

    // Fetch price (single coin fallback — prefer using prefetchCryptoPrices for batching)
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
      params: { ids: coinId, vs_currencies: currency.toLowerCase() },
      timeout: 10000
    });
    const price = response.data[coinId]?.[currency.toLowerCase()] || 0;

    if (price > 0) {
      cryptoPriceCache.set(cacheKey, { price, fetchedAt: now });
    }

    console.log(`Fetched ${symbol} (${coinId}) price: ${price} ${currency}`);
    return price;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error(`Rate limit hit for ${symbol}, using fallback...`);
      const coinId = getCoinGeckoId(symbol);
      const cacheKey = `${coinId}-${currency}`;
      const cached = cryptoPriceCache.get(cacheKey);
      if (cached) {
        console.log(`Using expired cache for ${symbol}: ${cached.price}`);
        return cached.price;
      }
    }
    console.error(`Error fetching crypto price for ${symbol}:`, error.message);
    return 0;
  }
}

// Batch-fetch all crypto prices in ONE CoinGecko request — prevents rate limiting.
// Only calls CoinGecko if DB cache is stale (no fresh prices found).
// Deduplicates concurrent calls: if a fetch for the same currency is in-flight, callers wait for it.
async function prefetchCryptoPrices(assets, currency = 'EUR') {
  const cryptoAssets = assets.filter(a => a.type === 'crypto');
  if (!cryptoAssets.length) return;

  // If a batch request for this currency is already in-flight, reuse it
  if (pendingPrefetches.has(currency)) {
    return pendingPrefetches.get(currency);
  }

  const fetchPromise = (async () => {
    // Check how many cryptos already have a fresh DB cache entry
    const assetIds = cryptoAssets.map(a => a.id).filter(Boolean);
    const cutoff = new Date(Date.now() - CACHE_DURATION);
    const freshCount = assetIds.length > 0 ? await prisma.priceCache.count({
      where: { assetId: { in: assetIds }, currency, timestamp: { gte: cutoff }, price: { gt: 0 } }
    }) : 0;

    // All cryptos have fresh DB cache — no need to hit CoinGecko
    if (freshCount >= cryptoAssets.length) return;

    // Some or all are stale — batch fetch from CoinGecko (1 request for all)
    const symbols = [...new Set(cryptoAssets.map(a => a.symbol.toUpperCase()))];
    const coinIds = symbols.map(s => getCoinGeckoId(s));

    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids: coinIds.join(','), vs_currencies: currency.toLowerCase() },
        timeout: 15000
      });
      const now = Date.now();
      let count = 0;
      symbols.forEach((sym, i) => {
        const coinId = coinIds[i];
        const price = response.data[coinId]?.[currency.toLowerCase()] || 0;
        if (price > 0) {
          cryptoPriceCache.set(`${coinId}-${currency}`, { price, fetchedAt: now });
          count++;
        }
      });
      console.log(`Batch crypto fetch: ${count}/${symbols.length} prices loaded (${currency})`);
    } catch (error) {
      console.error('Batch crypto prefetch error:', error.message);
    }
  })();

  pendingPrefetches.set(currency, fetchPromise);
  fetchPromise.finally(() => pendingPrefetches.delete(currency));
  return fetchPromise;
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

async function fetchYahooChart(symbol) {
  const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
  const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`;
  try {
    const r = await axios.get(url1, { headers: YAHOO_HEADERS, timeout: 10000 });
    return r.data;
  } catch (e1) {
    console.warn(`[Yahoo] query1 failed for ${symbol} (${e1.response?.status ?? e1.message}), trying query2...`);
    const r = await axios.get(url2, { headers: YAHOO_HEADERS, timeout: 10000 });
    return r.data;
  }
}

async function getStockPrice(symbol, currency = 'EUR') {
  try {
    const data = await fetchYahooChart(symbol);
    let price = data.chart.result[0].meta.regularMarketPrice || 0;
    const stockCurrency = data.chart.result[0].meta.currency;
    
    // Convert if needed
    if (stockCurrency !== currency && price > 0) {
      const rate = await getExchangeRate(stockCurrency, currency);
      price *= rate;
    }
    
    return price;
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error.message);
    return 0;
  }
}

async function getMetalPrice(symbol, currency = 'EUR') {
  const cacheKey = `${symbol.toUpperCase()}-${currency}`;
  const now = Date.now();

  // In-memory cache check
  const cached = metalPriceCache.get(cacheKey);
  if (cached && (now - cached.fetchedAt) < CACHE_DURATION) {
    return cached.price;
  }

  // Map to Yahoo Finance futures symbols (same source already used for stocks/ETFs)
  const yahooSymbolMap = { 'XAU': 'GC=F', 'XAG': 'SI=F' };
  const yahooSymbol = yahooSymbolMap[symbol.toUpperCase()];
  if (!yahooSymbol) return 0;

  try {
    // Reuse getStockPrice — handles Yahoo Finance + currency conversion
    const price = await getStockPrice(yahooSymbol, currency);

    if (price > 0) {
      metalPriceCache.set(cacheKey, { price, fetchedAt: now });
    }

    return price;
  } catch (error) {
    console.error(`Error fetching metal price for ${symbol}:`, error.message);
    if (cached) {
      console.warn(`Using expired memory cache for ${symbol}: ${cached.price}`);
      return cached.price;
    }
    return 0;
  }
}

// Fetch the full CS2 price list in one request, build a lookup Map
async function fetchCS2BulkPrices() {
  const now = Date.now();
  if (cs2BulkPricesMap && (now - cs2BulkFetchedAt) < CACHE_DURATION) {
    return cs2BulkPricesMap;
  }
  console.log('[CS2] Fetching bulk price list...');
  const res = await axios.get(CS2_BULK_URL, { timeout: 30000 });
  const items = res.data?.items;
  if (!Array.isArray(items)) throw new Error('Unexpected CS2 price API response format');
  cs2BulkPricesMap = new Map();
  for (const item of items) {
    const usd = parseFloat(item.price) || 0;
    if (usd > 0 && item.market_hash_name) cs2BulkPricesMap.set(item.market_hash_name, usd);
  }
  cs2BulkFetchedAt = now;
  console.log(`[CS2] Bulk prices loaded: ${cs2BulkPricesMap.size} items`);
  return cs2BulkPricesMap;
}

async function getCS2SkinPrice(marketHashName, currency = 'EUR') {
  const cacheKey = `${marketHashName}-${currency}`;
  const now = Date.now();
  const cached = cs2SkinPriceCache.get(cacheKey);
  if (cached && (now - cached.fetchedAt) < CACHE_DURATION) return cached.price;

  try {
    const bulkPrices = await fetchCS2BulkPrices();
    const priceUsd = bulkPrices.get(marketHashName) || 0;
    if (!priceUsd) {
      console.warn(`[CS2] No price found for "${marketHashName}"`);
      return 0;
    }
    const rate = await getExchangeRate('USD', currency);
    const price = priceUsd * rate;
    if (price > 0) cs2SkinPriceCache.set(cacheKey, { price, fetchedAt: now });
    return price;
  } catch (error) {
    console.error(`[CS2] Error fetching bulk prices:`, error.message);
    if (cached) return cached.price;
    return 0;
  }
}

async function getExchangeRate(from, to) {
  if (from === to) return 1;

  const cacheKey = `${from}-${to}`;
  const now = Date.now();
  const cached = exchangeRateCache.get(cacheKey);
  if (cached && (now - cached.fetchedAt) < EXCHANGE_RATE_TTL) {
    return cached.rate;
  }

  try {
    const response = await axios.get(`https://api.frankfurter.app/latest`, {
      params: { from, to }
    });
    const rate = response.data.rates[to] || 1;
    exchangeRateCache.set(cacheKey, { rate, fetchedAt: now });
    return rate;
  } catch (error) {
    console.error(`Error fetching exchange rate ${from}/${to}:`, error.message);
    // Use expired cache if available
    if (cached) return cached.rate;
    return 1;
  }
}

async function getHistoricalPrice(asset, date, currency = 'EUR') {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    switch (asset.type) {
      case 'crypto':
        return await getCryptoHistoricalPrice(asset.symbol, dateStr, currency);
      case 'stock':
      case 'etf':
        return await getStockHistoricalPrice(asset.symbol, dateStr, currency);
      default:
        return await getCurrentPrice(asset, currency);
    }
  } catch (error) {
    console.error(`Error fetching historical price:`, error.message);
    return 0;
  }
}

async function getCryptoHistoricalPrice(symbol, date, currency) {
  const coinId = getCoinGeckoId(symbol);
  const [day, month, year] = date.split('-').reverse();
  
  const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}/history`, {
    params: { date: `${day}-${month}-${year}` }
  });
  
  return response.data.market_data?.current_price?.[currency.toLowerCase()] || 0;
}

async function getStockHistoricalPrice(symbol, date, currency) {
  try {
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const params = { period1: timestamp - 86400, period2: Math.min(timestamp + 86400, now), interval: '1d' };
    const url1 = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const url2 = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`;

    let data;
    try {
      const r = await axios.get(url1, { params, headers: YAHOO_HEADERS, timeout: 10000 });
      data = r.data;
    } catch (e1) {
      console.warn(`[Yahoo] query1 historical failed for ${symbol} (${e1.response?.status ?? e1.message}), trying query2...`);
      const r = await axios.get(url2, { params, headers: YAHOO_HEADERS, timeout: 10000 });
      data = r.data;
    }
    const result = data.chart.result?.[0];
    if (!result) return 0;
    const quotes = result.indicators.quote[0];

    let price = quotes.close?.find(p => p !== null) ||
                quotes.open?.find(p => p !== null) ||
                quotes.high?.find(p => p !== null) || 0;

    if (!price) {
      price = result.meta.regularMarketPrice || result.meta.chartPreviousClose || 0;
    }

    const stockCurrency = result.meta.currency;
    if (stockCurrency !== currency && price > 0) {
      const rate = await getExchangeRate(stockCurrency, currency);
      price *= rate;
    }

    console.log(`Historical price for ${symbol} on ${date}: ${price}`);
    return price;
  } catch (error) {
    console.error(`Error fetching historical stock price for ${symbol}:`, error.message);
    return 0;
  }
}

const coinGeckoMap = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'SOL': 'solana',
  'DOGE': 'dogecoin',
  'TRX': 'tron',
  'MATIC': 'matic-network',
  'DOT': 'polkadot',
  'ATOM': 'cosmos',
  'CRO': 'crypto-com-chain',
  'LTC': 'litecoin'
};

function getCoinGeckoId(symbol) {
  return coinGeckoMap[symbol.toUpperCase()] || symbol.toLowerCase();
}

module.exports = {
  getCurrentPrice,
  prefetchCryptoPrices,
  getHistoricalPrice,
  getExchangeRate,
  fetchCS2BulkPrices
};
