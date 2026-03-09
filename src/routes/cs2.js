const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { resolveSteamId, fetchSteamInventory } = require('../services/cs2Service');
const { fetchCS2BulkPrices, getExchangeRate } = require('../services/priceService');

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
// Response: SSE stream of progress events
router.post('/import', async (req, res) => {
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

  // Switch to SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Save the Steam profile for future re-syncs
    await prisma.steamProfile.upsert({
      where: { userId_steamId: { userId, steamId } },
      create: { userId, steamId, steamUrl: steamUrl || null },
      update: { steamUrl: steamUrl || null }
    });

    // Fetch current inventory from Steam
    const skins = await fetchSteamInventory(steamId);
    const total = skins.length;

    // Fetch all CS2 prices in one request, then get EUR exchange rate
    const bulkPrices = await fetchCS2BulkPrices();
    const eurRate = await getExchangeRate('USD', 'EUR');

    const results = { imported: 0, skipped: 0, noPrice: 0 };
    const importNotes = `Steam import:${steamId}`;
    const noPriceList = [];

    for (let i = 0; i < skins.length; i++) {
      const { marketHashName, count, iconUrl } = skins[i];

      // Stream progress to client
      res.write(`data: ${JSON.stringify({ current: i + 1, total, skinName: marketHashName })}\n\n`);

      // Skip skins with no known market price
      const priceUsd = bulkPrices.get(marketHashName) || 0;
      if (priceUsd === 0) {
        noPriceList.push(marketHashName);
        results.noPrice++;
        continue;
      }
      const priceEur = priceUsd * eurRate;

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
        results.skipped++;
        continue;
      }

      // Create a buy transaction with the current market price as cost basis
      await prisma.transaction.create({
        data: {
          portfolioId,
          assetId: asset.id,
          type: 'buy',
          quantity: count,
          pricePerUnit: priceEur,
          fees: 0,
          currency: 'EUR',
          date: new Date(),
          notes: importNotes
        }
      });

      // Update holding with weighted average price
      const holding = await prisma.holding.findUnique({
        where: { portfolioId_assetId: { portfolioId, assetId: asset.id } }
      });

      if (holding) {
        const existingQty = parseFloat(holding.quantity);
        const existingAvg = parseFloat(holding.avgPrice);
        const newQty = existingQty + count;
        const newAvg = ((existingQty * existingAvg) + (count * priceEur)) / newQty;
        await prisma.holding.update({
          where: { id: holding.id },
          data: { quantity: newQty, avgPrice: newAvg }
        });
      } else {
        await prisma.holding.create({
          data: { portfolioId, assetId: asset.id, quantity: count, avgPrice: priceEur }
        });
      }

      results.imported++;
    }

    // Write import history entry (same table as CSV/Excel imports)
    const ignoredCount = results.noPrice + results.skipped;
    const ignoredAssets = [
      ...noPriceList.map(n => `${n} — prix introuvable`),
      ...(results.skipped > 0 ? [`${results.skipped} skin(s) déjà importé(s)`] : [])
    ];
    try {
      await prisma.$executeRaw`
        INSERT INTO "ImportHistory" (id, "portfolioId", "fileName", "totalRows", "successCount", "ignoredCount", "errorCount", "ignoredAssets", errors, "createdAt")
        VALUES (gen_random_uuid()::text, ${portfolioId}, ${'Steam: ' + steamId}, ${total}, ${results.imported}, ${ignoredCount}, ${0}, ${JSON.stringify(ignoredAssets)}::jsonb, ${JSON.stringify([])}::jsonb, NOW())
      `;
    } catch (e) {
      console.error('Failed to save import history:', e.message);
    }

    res.write(`data: ${JSON.stringify({ done: true, results })}\n\n`);
    res.end();
  } catch (error) {
    console.error('CS2 import error:', error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
