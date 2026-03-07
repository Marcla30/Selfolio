const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentPrice, prefetchCryptoPrices } = require('../services/priceService');
const router = express.Router();
const prisma = new PrismaClient();

async function getUserPortfolioIds(userId) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    select: { id: true }
  });
  return portfolios.map(p => p.id);
}

router.get('/', async (req, res) => {
  try {
    const portfolioIds = await getUserPortfolioIds(req.session.userId);

    let where = { portfolioId: { in: portfolioIds } };
    if (req.query.portfolioId) {
      if (!portfolioIds.includes(req.query.portfolioId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where = { portfolioId: req.query.portfolioId };
    }

    const holdings = await prisma.holding.findMany({
      where,
      include: { asset: true, portfolio: true }
    });

    const currency = req.query.currency || 'EUR';

    // Batch-fetch all crypto prices in one request to avoid rate limiting
    await prefetchCryptoPrices(holdings.map(h => h.asset), currency);

    const enriched = await Promise.all(holdings.map(async h => {
      const price = await getCurrentPrice(h.asset, currency);
      const value = parseFloat(h.quantity) * price;
      return { ...h, currentPrice: price, currentValue: value };
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const portfolioIds = await getUserPortfolioIds(req.session.userId);

    const currentHolding = await prisma.holding.findUnique({
      where: { id: req.params.id }
    });

    if (!currentHolding || !portfolioIds.includes(currentHolding.portfolioId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { quantity, avgPrice, portfolioId } = req.body;
    const updateData = { quantity, avgPrice };
    if (portfolioId) {
      if (!portfolioIds.includes(portfolioId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      updateData.portfolioId = portfolioId;
    }

    const updated = await prisma.holding.update({
      where: { id: req.params.id },
      data: updateData
    });

    if (portfolioId && portfolioId !== currentHolding.portfolioId) {
      await prisma.transaction.updateMany({
        where: {
          portfolioId: currentHolding.portfolioId,
          assetId: currentHolding.assetId
        },
        data: { portfolioId }
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const portfolioIds = await getUserPortfolioIds(req.session.userId);

    const holding = await prisma.holding.findUnique({
      where: { id: req.params.id },
      include: { asset: true }
    });

    if (!holding || !portfolioIds.includes(holding.portfolioId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.transaction.deleteMany({
      where: {
        assetId: holding.assetId,
        portfolioId: holding.portfolioId
      }
    });

    await prisma.holding.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
