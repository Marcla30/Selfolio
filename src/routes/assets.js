const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getCurrentPrice } = require('../services/priceService');
const { getHistoricalPrice } = require('../services/historicalPriceService');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const assets = await prisma.asset.findMany();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: req.params.id },
      include: { transactions: { orderBy: { date: 'desc' } } }
    });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const asset = await prisma.asset.create({ data: req.body });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/price', async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    const price = await getCurrentPrice(asset, req.query.currency || 'EUR');
    res.json({ price });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/historical-price', async (req, res) => {
  try {
    const { date, currency = 'EUR' } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const price = await getHistoricalPrice(asset, new Date(date), currency);
    res.json({ price });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
