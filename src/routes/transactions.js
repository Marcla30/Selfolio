const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getHistoricalPrice } = require('../services/historicalPriceService');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.portfolioId) where.portfolioId = req.query.portfolioId;
    if (req.query.assetId) where.assetId = req.query.assetId;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { asset: true, portfolio: true },
      orderBy: { date: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { portfolioId, assetId, type, quantity, date, fees, currency } = req.body;
    
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    let pricePerUnit = req.body.pricePerUnit;

    if (!pricePerUnit) {
      pricePerUnit = await getHistoricalPrice(asset, new Date(date), currency || 'EUR');
    }

    const transaction = await prisma.transaction.create({
      data: { portfolioId, assetId, type, quantity, pricePerUnit, date: new Date(date), fees: fees || 0, currency: currency || 'EUR' }
    });

    await updateHolding(portfolioId, assetId, type, parseFloat(quantity), parseFloat(pricePerUnit));

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { type, quantity, pricePerUnit, fees, date } = req.body;
    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: { type, quantity, pricePerUnit, fees, date: new Date(date) }
    });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function updateHolding(portfolioId, assetId, type, quantity, price) {
  const holding = await prisma.holding.findUnique({
    where: { portfolioId_assetId: { portfolioId, assetId } }
  });

  if (type === 'buy') {
    if (holding) {
      const newQty = parseFloat(holding.quantity) + quantity;
      const newAvg = ((parseFloat(holding.quantity) * parseFloat(holding.avgPrice)) + (quantity * price)) / newQty;
      await prisma.holding.update({
        where: { id: holding.id },
        data: { quantity: newQty, avgPrice: newAvg }
      });
    } else {
      await prisma.holding.create({
        data: { portfolioId, assetId, quantity, avgPrice: price }
      });
    }
  } else if (type === 'sell' && holding) {
    const newQty = parseFloat(holding.quantity) - quantity;
    if (newQty <= 0) {
      await prisma.holding.delete({ where: { id: holding.id } });
    } else {
      await prisma.holding.update({
        where: { id: holding.id },
        data: { quantity: newQty }
      });
    }
  }
}

module.exports = router;
