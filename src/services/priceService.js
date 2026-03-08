const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CACHE_DURATION = 35 * 60 * 1000; // 35 min — slightly more than the 30-min snapshot interval
// Per-coin in-memory cache: cacheKey -> { price, fetchedAt }
const cryptoPriceCache = new Map();

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
async function prefetchCryptoPrices(assets, currency = 'EUR') {
  const cryptoAssets = assets.filter(a => a.type === 'crypto');
  if (!cryptoAssets.length) return;

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
}

async function getStockPrice(symbol, currency = 'EUR') {
  try {
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    let price = response.data.chart.result[0].meta.regularMarketPrice || 0;
    const stockCurrency = response.data.chart.result[0].meta.currency;
    
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
  try {
    const metalMap = {
      'XAU': 'XAU',
      'XAG': 'XAG'
    };
    
    const metalSymbol = metalMap[symbol.toUpperCase()];
    if (!metalSymbol) return 0;
    
    // Using gold-api.com free endpoint
    const response = await axios.get(`https://api.gold-api.com/price/${metalSymbol}`);
    
    let price = response.data.price || 0;
    
    // Price is in USD per troy ounce, convert to requested currency
    if (currency !== 'USD' && price > 0) {
      const rate = await getExchangeRate('USD', currency);
      price *= rate;
    }
    
    return price;
  } catch (error) {
    console.error(`Error fetching metal price for ${symbol}:`, error.message);
    // Fallback to approximate prices in USD
    const fallbackPrices = {
      'XAU': 5080,
      'XAG': 62
    };
    let price = fallbackPrices[symbol.toUpperCase()] || 0;
    
    if (currency !== 'USD' && price > 0) {
      const rate = await getExchangeRate('USD', currency);
      price *= rate;
    }
    
    return price;
  }
}

async function getExchangeRate(from, to) {
  if (from === to) return 1;
  
  try {
    const response = await axios.get(`https://api.frankfurter.app/latest`, {
      params: { from, to }
    });
    return response.data.rates[to] || 1;
  } catch (error) {
    console.error(`Error fetching exchange rate ${from}/${to}:`, error.message);
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
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      params: { 
        period1: timestamp - 86400,
        period2: timestamp + 86400,
        interval: '1d'
      }
    });
    
    const result = response.data.chart.result[0];
    const quotes = result.indicators.quote[0];
    
    // Try to get close price, fallback to open or high
    let price = quotes.close?.find(p => p !== null) || 
                quotes.open?.find(p => p !== null) || 
                quotes.high?.find(p => p !== null) || 0;
    
    // If still no price, try current price
    if (price === 0) {
      price = result.meta.regularMarketPrice || 0;
    }
    
    // Convert if needed
    if (currency !== 'EUR' && result.meta.currency === 'EUR' && price > 0) {
      const rate = await getExchangeRate('EUR', currency);
      price *= rate;
    } else if (currency !== 'USD' && result.meta.currency === 'USD' && price > 0) {
      const rate = await getExchangeRate('USD', currency);
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
  getExchangeRate
};
