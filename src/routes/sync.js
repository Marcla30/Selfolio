const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.post('/sync', async (req, res) => {
  try {
    const userPortfolios = await prisma.portfolio.findMany({
      where: { userId: req.session.userId },
      select: { id: true }
    });
    const portfolioIds = userPortfolios.map(p => p.id);

    const transactions = await prisma.transaction.findMany({
      where: { portfolioId: { in: portfolioIds } },
      orderBy: { date: 'asc' }
    });

    await prisma.holding.deleteMany({
      where: { portfolioId: { in: portfolioIds } }
    });

    const holdingsMap = new Map();

    for (const tx of transactions) {
      const key = `${tx.portfolioId}-${tx.assetId}`;

      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, {
          portfolioId: tx.portfolioId,
          assetId: tx.assetId,
          quantity: 0,
          totalCost: 0,
          avgPrice: 0
        });
      }

      const holding = holdingsMap.get(key);

      if (tx.type === 'buy') {
        const newQuantity = holding.quantity + parseFloat(tx.quantity);
        const newTotalCost = holding.totalCost + (parseFloat(tx.quantity) * parseFloat(tx.pricePerUnit));
        holding.quantity = newQuantity;
        holding.totalCost = newTotalCost;
        holding.avgPrice = newTotalCost / newQuantity;
      } else if (tx.type === 'sell') {
        if (holding.quantity > 0 && holding.avgPrice > 0) {
          const soldCost = parseFloat(tx.quantity) * holding.avgPrice;
          holding.quantity -= parseFloat(tx.quantity);
          holding.totalCost -= soldCost;
        }
      }
    }

    for (const [, data] of holdingsMap) {
      if (data.quantity > 0) {
        await prisma.holding.create({
          data: {
            portfolioId: data.portfolioId,
            assetId: data.assetId,
            quantity: data.quantity,
            avgPrice: data.avgPrice
          }
        });
      }
    }

    res.json({ success: true, message: 'Holdings synchronized' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
