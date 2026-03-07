const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.session.userId },
      include: { _count: { select: { holdings: true } } }
    });
    res.json(portfolios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const portfolio = await prisma.portfolio.create({
      data: { ...req.body, userId: req.session.userId }
    });
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.portfolio.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const portfolio = await prisma.portfolio.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.portfolio.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.session.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.portfolio.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
