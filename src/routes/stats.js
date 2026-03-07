const express = require('express');
const { getPortfolioStats, getRecommendations, getRealizedGains, getChange24h } = require('../services/statsService');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stats = await getPortfolioStats(req.query.portfolioId, req.query.currency, req.session.userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const recommendations = await getRecommendations(req.query.portfolioId, req.session.userId);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history-peaks', async (req, res) => {
  try {
    const { getHistoryPeaks } = require('../services/statsService');
    const peaks = await getHistoryPeaks(req.query.portfolioId, req.query.currency, req.session.userId);
    res.json(peaks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/realized-gains', async (req, res) => {
  try {
    const data = await getRealizedGains(req.query.portfolioId, req.session.userId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/change24h', async (req, res) => {
  try {
    const data = await getChange24h(req.session.userId, req.query.currency || 'EUR');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
