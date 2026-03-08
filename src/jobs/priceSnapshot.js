const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { getCurrentPrice, prefetchCryptoPrices } = require('../services/priceService');
const prisma = new PrismaClient();

async function saveDailyPrices() {
  console.log('Starting price snapshot...');
  
  try {
    // Get all unique assets from holdings and recent transactions
    const assets = await prisma.asset.findMany({
      where: {
        OR: [
          { holdings: { some: {} } },
          { transactions: { some: { date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } } }
        ]
      }
    });

    const settings = await prisma.settings.findFirst();
    const currency = settings?.defaultCurrency || 'EUR';

    // Batch-fetch all crypto prices in one request before the loop
    await prefetchCryptoPrices(assets, currency);

    let saved = 0;
    for (const asset of assets) {
      try {
        // force=true bypasses the 5-min cache so we always get a fresh price
        const price = await getCurrentPrice(asset, currency, true);
        if (price > 0) saved++;
      } catch (error) {
        console.error(`Error saving price for ${asset.symbol}:`, error.message);
      }
    }

    console.log(`Price snapshot completed: ${saved}/${assets.length} prices saved`);
  } catch (error) {
    console.error('Price snapshot error:', error);
  }
}

function startDailyPriceJob() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', saveDailyPrices);
  console.log('Price snapshot job scheduled (every 30 minutes)');

  // Run immediately on startup if no prices saved in last 30 minutes
  checkAndRunInitial();
}

async function checkAndRunInitial() {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const recentPrices = await prisma.priceCache.count({
      where: {
        timestamp: { gte: thirtyMinAgo }
      }
    });

    if (recentPrices === 0) {
      console.log('No prices saved in last 30 minutes, running initial snapshot...');
      await saveDailyPrices();
    }
  } catch (error) {
    console.error('Initial price check error:', error);
  }
}

module.exports = { startDailyPriceJob, saveDailyPrices };
