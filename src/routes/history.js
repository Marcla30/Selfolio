const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const { portfolioId, timeframe = '30d', currency = 'EUR' } = req.query;

    const userPortfolios = await prisma.portfolio.findMany({
      where: { userId: req.session.userId },
      select: { id: true }
    });
    const portfolioIds = userPortfolios.map(p => p.id);

    let where = { portfolioId: { in: portfolioIds } };
    if (portfolioId) {
      if (!portfolioIds.includes(portfolioId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where = { portfolioId };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { asset: true },
      orderBy: { date: 'asc' }
    });

    if (transactions.length === 0) {
      return res.json({ labels: [], data: [] });
    }

    // Get timeframe range
    const now = new Date();
    const startDate = getStartDate(timeframe);
    
    // Calculate portfolio value at different points in time
    const dataPoints = getDataPoints(timeframe);
    const labels = [];
    const data = [];

    for (let i = 0; i <= dataPoints; i++) {
      const pointDate = new Date(startDate.getTime() + (now - startDate) * i / dataPoints);
      
      // Get all transactions up to this point
      const txUpToPoint = transactions.filter(t => new Date(t.date) <= pointDate);
      
      // Calculate holdings at this point
      const holdings = {};
      for (const tx of txUpToPoint) {
        if (!holdings[tx.assetId]) {
          holdings[tx.assetId] = { quantity: 0, asset: tx.asset };
        }
        
        if (tx.type === 'buy') {
          holdings[tx.assetId].quantity += parseFloat(tx.quantity);
        } else if (tx.type === 'sell') {
          holdings[tx.assetId].quantity -= parseFloat(tx.quantity);
        }
      }
      
      // Calculate total value at this point using historical prices
      let totalValue = 0;
      for (const assetId in holdings) {
        if (holdings[assetId].quantity > 0) {
          const price = await getHistoricalPrice(holdings[assetId].asset, pointDate, currency);
          totalValue += holdings[assetId].quantity * price;
        }
      }
      
      labels.push(formatLabel(pointDate, timeframe));
      data.push(totalValue);
    }

    res.json({ labels, data });
  } catch (error) {
    console.error('Portfolio history error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function getHistoricalPrice(asset, date, currency) {
  try {
    // Try to find cached price closest to the date
    const cachedPrice = await prisma.priceCache.findFirst({
      where: {
        assetId: asset.id,
        currency,
        timestamp: {
          lte: date,
          gte: new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000) // Within 7 days
        }
      },
      orderBy: { timestamp: 'desc' }
    });
    
    if (cachedPrice) {
      return parseFloat(cachedPrice.price);
    }
    
    // Fallback to current price if no historical data
    const { getCurrentPrice } = require('../services/priceService');
    return await getCurrentPrice(asset, currency);
  } catch (error) {
    console.error(`Error getting historical price for ${asset.symbol}:`, error.message);
    return 0;
  }
}

function getStartDate(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '24h': return new Date(now - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case '1y': return new Date(now - 365 * 24 * 60 * 60 * 1000);
    case 'all': return new Date(now - 730 * 24 * 60 * 60 * 1000);
    default: return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
}

function getDataPoints(timeframe) {
  switch (timeframe) {
    case '24h': return 24;
    case '7d': return 14;
    case '30d': return 30;
    case '1y': return 52;
    case 'all': return 100;
    default: return 30;
  }
}

function formatLabel(date, timeframe) {
  if (timeframe === '24h') {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } else if (timeframe === '7d' || timeframe === '30d') {
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  }
}

module.exports = router;
