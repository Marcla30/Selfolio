const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { resolveSteamId, fetchSteamInventory } = require('../services/cs2Service');

const prisma = new PrismaClient();

// GET /api/cs2/preview?url=...
// Preview a Steam inventory without importing anything
router.get('/preview', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const steamId = await resolveSteamId(url);
    const skins = await fetchSteamInventory(steamId);

    res.json({ steamId, count: skins.length, skins });
  } catch (error) {
    console.error('CS2 preview error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/cs2/import
// Import CS2 skins from Steam inventory into a portfolio
// body: { steamId, steamUrl, portfolioId }
router.post('/import', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { steamId, steamUrl, portfolioId } = req.body;

    if (!steamId || !portfolioId) {
      return res.status(400).json({ error: 'Missing steamId or portfolioId' });
    }

    // Verify the portfolio belongs to this user
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: portfolioId, userId }
    });
    if (!portfolio) {
      return res.status(403).json({ error: 'Portfolio not found or access denied' });
    }

    // Save the Steam profile for future re-syncs
    await prisma.steamProfile.upsert({
      where: { userId_steamId: { userId, steamId } },
      create: { userId, steamId, steamUrl: steamUrl || null },
      update: { steamUrl: steamUrl || null }
    });

    // Fetch current inventory from Steam
    const skins = await fetchSteamInventory(steamId);

    let imported = 0;
    let skipped = 0;

    const importNotes = `Steam import:${steamId}`;

    for (const skin of skins) {
      const { marketHashName, count, iconUrl } = skin;

      // Find or create the Asset record
      let asset = await prisma.asset.findUnique({ where: { symbol: marketHashName } });
      if (!asset) {
        asset = await prisma.asset.create({
          data: {
            symbol: marketHashName,
            name: marketHashName,
            type: 'cs2skin',
            logoUrl: iconUrl || null
          }
        });
      }

      // Check if this skin was already imported from this Steam profile (anti-duplicate)
      const existingTx = await prisma.transaction.findFirst({
        where: { portfolioId, assetId: asset.id, notes: importNotes }
      });

      if (existingTx) {
        skipped++;
        continue;
      }

      // Create a buy transaction with price=0 (purchase price unknown at import time)
      await prisma.transaction.create({
        data: {
          portfolioId,
          assetId: asset.id,
          type: 'buy',
          quantity: count,
          pricePerUnit: 0,
          fees: 0,
          currency: 'EUR',
          date: new Date(),
          notes: importNotes
        }
      });

      // Update the holding (upsert: create or add to existing)
      const holding = await prisma.holding.findUnique({
        where: { portfolioId_assetId: { portfolioId, assetId: asset.id } }
      });

      if (holding) {
        // price=0 import: weighted average stays the same if existing avgPrice > 0
        const existingQty = parseFloat(holding.quantity);
        const existingAvg = parseFloat(holding.avgPrice);
        const newQty = existingQty + count;
        // Keep existing avgPrice if the import is at price=0
        const newAvg = existingAvg > 0
          ? ((existingQty * existingAvg) / newQty) // price-0 units don't affect avg
          : 0;
        await prisma.holding.update({
          where: { id: holding.id },
          data: { quantity: newQty, avgPrice: newAvg }
        });
      } else {
        await prisma.holding.create({
          data: { portfolioId, assetId: asset.id, quantity: count, avgPrice: 0 }
        });
      }

      imported++;
    }

    res.json({ imported, skipped, total: skins.length });
  } catch (error) {
    console.error('CS2 import error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
