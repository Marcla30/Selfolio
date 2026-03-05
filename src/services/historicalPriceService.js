const axios = require('axios');

// Get historical price at specific date/time
async function getHistoricalPrice(asset, datetime, currency = 'EUR') {
  const timestamp = Math.floor(new Date(datetime).getTime() / 1000);
  
  try {
    switch (asset.type) {
      case 'crypto':
        return await getCryptoHistoricalPrice(asset.symbol, timestamp, currency);
      case 'stock':
      case 'etf':
        return await getStockHistoricalPrice(asset.symbol, timestamp, currency);
      case 'metal':
        return await getMetalHistoricalPrice(asset.symbol, timestamp, currency);
      default:
        return 0;
    }
  } catch (error) {
    console.error(`Error fetching historical price for ${asset.symbol}:`, error.message);
    return 0;
  }
}

// CryptoCompare - Free tier: 100k calls/month, hourly data
async function getCryptoHistoricalPrice(symbol, timestamp, currency) {
  try {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/histohour', {
      params: {
        fsym: symbol.toUpperCase(),
        tsym: currency.toUpperCase(),
        limit: 1,
        toTs: timestamp
      }
    });
    
    if (response.data.Response === 'Success' && response.data.Data?.Data?.length > 0) {
      const data = response.data.Data.Data[0];
      // Average of open and close for better accuracy
      return (data.open + data.close) / 2;
    }
    
    return 0;
  } catch (error) {
    console.error(`CryptoCompare error for ${symbol}:`, error.message);
    return 0;
  }
}

// Yahoo Finance - Free, minute data for last 7 days, daily otherwise
async function getStockHistoricalPrice(symbol, timestamp, currency) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const daysAgo = (now - timestamp) / 86400;
    
    // Use minute data if within last 7 days
    const interval = daysAgo <= 7 ? '1m' : '1d';
    const period1 = interval === '1m' ? timestamp - 3600 : timestamp - 86400;
    const period2 = interval === '1m' ? timestamp + 3600 : timestamp + 86400;
    
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      params: { 
        period1,
        period2,
        interval
      }
    });
    
    const result = response.data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote[0];
    
    // Find closest timestamp
    let closestIndex = 0;
    let minDiff = Math.abs(timestamps[0] - timestamp);
    
    for (let i = 1; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
      }
    }
    
    let price = quotes.close?.[closestIndex] || 
                quotes.open?.[closestIndex] || 
                quotes.high?.[closestIndex] || 0;
    
    // Convert currency if needed
    const stockCurrency = result.meta.currency;
    if (stockCurrency !== currency && price > 0) {
      const rate = await getExchangeRate(stockCurrency, currency);
      price *= rate;
    }
    
    console.log(`Historical price for ${symbol} at ${new Date(timestamp * 1000).toISOString()}: ${price}`);
    return price;
  } catch (error) {
    console.error(`Yahoo Finance error for ${symbol}:`, error.message);
    return 0;
  }
}

// Metals - Daily data only (no intraday available for free)
async function getMetalHistoricalPrice(symbol, timestamp, currency) {
  try {
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    
    // Frankfurter doesn't support metals, use current price as fallback
    console.log(`Metal historical prices not available for free, using current price`);
    return 0;
  } catch (error) {
    console.error(`Metal historical price error:`, error.message);
    return 0;
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
    console.error(`Exchange rate error ${from}/${to}:`, error.message);
    return 1;
  }
}

module.exports = {
  getHistoricalPrice
};
