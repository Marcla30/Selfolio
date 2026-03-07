const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { userId: req.session.userId }
    });
    if (!settings) {
      settings = await prisma.settings.create({ 
        data: { userId: req.session.userId } 
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: req.session.userId }
    });
    const updated = await prisma.settings.update({
      where: { id: settings.id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
