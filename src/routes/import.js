const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const router = express.Router();
const prisma = new PrismaClient();

const upload = multer({ storage: multer.memoryStorage() });

// Map ISIN to Yahoo Finance symbols
const isinToSymbol = {
  'LU1681043599': 'CW8.PA',
  'FR0011871128': 'PE500.PA',
  'FR0000120628': 'CS.PA',
  'FR0000130692': 'CRI.PA',
  'FR0014003TT8': 'DSY.PA',
  'FR0010221234': 'ETL.PA',
  'FR0011726835': 'GTT.PA',
  'FR0010396309': 'ALHIT.PA',
  'FR0000065773': 'MLCHI.PA',
  'FR0000077919': 'DEC.PA',
  'FR0000120073': 'AI.PA',
  'FR0013451333': 'FDJ.PA',
  'LU1834988781': 'LYPS.PA',
  'FR0010112524': 'NXI.PA',
  'FR0014005HJ9': 'OVH.PA',
  'FR0013269123': 'RUI.PA',
  'FR0000121972': 'SU.PA',
  'FR0000064271': 'STF.PA',
  'FR0000120271': 'TTE.PA',
  'FR0000054470': 'UBI.PA',
  'FR0000125486': 'DG.PA'
};

router.post('/import-excel', upload.single('file'), async (req, res) => {
  try {
    const { portfolioId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const results = { success: 0, errors: [], ignored: [] };
    const today = new Date().toISOString().split('T')[0];
    const total = data.length;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const isin = row['ISIN'];
        const name = row['Nom'];
        const quantity = parseFloat(row['Quantité']);
        const pru = parseFloat(row['PRU (EUR)']);
        
        if (!isin || !name || !quantity || !pru) {
          results.errors.push(`Ligne ignorée: ${name || 'inconnu'} - données manquantes`);
          res.write(`data: ${JSON.stringify({ progress: Math.round(((i + 1) / total) * 100), current: i + 1, total })}\n\n`);
          continue;
        }

        const symbol = isinToSymbol[isin];
        if (!symbol) {
          results.ignored.push(`${name} (${isin}) - ISIN non reconnu`);
          res.write(`data: ${JSON.stringify({ progress: Math.round(((i + 1) / total) * 100), current: i + 1, total })}\n\n`);
          continue;
        }

        let type = 'stock';
        if (name.includes('ETF') || name.includes('UCITS')) {
          type = 'etf';
        }

        let asset = await prisma.asset.findFirst({ where: { symbol } });
        
        if (!asset) {
          asset = await prisma.asset.create({
            data: { symbol, name, type }
          });
        }

        try {
          const priceTest = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
          const price = priceTest.data.chart.result[0].meta.regularMarketPrice;
          
          if (!price || price === 0) {
            results.ignored.push(`${name} (${symbol}) - Prix non disponible sur Yahoo Finance`);
            res.write(`data: ${JSON.stringify({ progress: Math.round(((i + 1) / total) * 100), current: i + 1, total })}\n\n`);
            continue;
          }
        } catch (e) {
          results.ignored.push(`${name} (${symbol}) - Erreur API: ${e.message}`);
          res.write(`data: ${JSON.stringify({ progress: Math.round(((i + 1) / total) * 100), current: i + 1, total })}\n\n`);
          continue;
        }

        await prisma.transaction.create({
          data: {
            portfolioId,
            assetId: asset.id,
            type: 'buy',
            quantity,
            pricePerUnit: pru,
            date: new Date(today),
            fees: 0,
            currency: 'EUR'
          }
        });

        results.success++;
        res.write(`data: ${JSON.stringify({ progress: Math.round(((i + 1) / total) * 100), current: i + 1, total })}\n\n`);
      } catch (error) {
        results.errors.push(`${row['Nom']}: ${error.message}`);
        res.write(`data: ${JSON.stringify({ progress: Math.round(((i + 1) / total) * 100), current: i + 1, total })}\n\n`);
      }
    }

    try {
      await prisma.$executeRaw`
        INSERT INTO "ImportHistory" (id, "portfolioId", "fileName", "totalRows", "successCount", "ignoredCount", "errorCount", "ignoredAssets", errors, "createdAt")
        VALUES (gen_random_uuid()::text, ${portfolioId}, ${req.file.originalname}, ${data.length}, ${results.success}, ${results.ignored.length}, ${results.errors.length}, ${JSON.stringify(results.ignored)}::jsonb, ${JSON.stringify(results.errors)}::jsonb, NOW())
      `;
    } catch (e) {
      console.error('Failed to save import history:', e.message);
    }

    await fetch('http://localhost:3000/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    res.write(`data: ${JSON.stringify({ done: true, results })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

router.get('/import-history', async (req, res) => {
  try {
    const history = await prisma.$queryRaw`
      SELECT * FROM "ImportHistory" ORDER BY "createdAt" DESC LIMIT 20
    `;
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import-history', async (req, res) => {
  try {
    const { fileName, totalRows, successCount, ignoredCount, errorCount, ignoredAssets, errors } = req.body;
    await prisma.$executeRaw`
      INSERT INTO "ImportHistory" (id, "portfolioId", "fileName", "totalRows", "successCount", "ignoredCount", "errorCount", "ignoredAssets", errors, "createdAt")
      VALUES (gen_random_uuid(), 'csv', ${fileName}, ${totalRows}, ${successCount}, ${ignoredCount}, ${errorCount}, ${JSON.stringify(ignoredAssets || [])}::jsonb, ${JSON.stringify(errors || [])}::jsonb, NOW())
    `;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
