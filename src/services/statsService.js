const { PrismaClient } = require('@prisma/client');
const { getCurrentPrice } = require('./priceService');
const prisma = new PrismaClient();

async function getUserPortfolioIds(userId, portfolioId) {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    select: { id: true }
  });
  const ids = portfolios.map(p => p.id);
  if (portfolioId && !ids.includes(portfolioId)) {
    throw new Error('Forbidden');
  }
  return portfolioId ? [portfolioId] : ids;
}

async function getPortfolioStats(portfolioId, currency = 'EUR', userId) {
  const portfolioIds = await getUserPortfolioIds(userId, portfolioId);

  const holdings = await prisma.holding.findMany({
    where: { portfolioId: { in: portfolioIds } },
    include: { asset: true, portfolio: true }
  });

  let totalValue = 0;
  const assetValues = [];

  for (const holding of holdings) {
    const currentPrice = await getCurrentPrice(holding.asset, currency);
    const value = parseFloat(holding.quantity) * currentPrice;
    totalValue += value;

    assetValues.push({
      asset: holding.asset,
      quantity: parseFloat(holding.quantity),
      currentPrice,
      value,
      avgPrice: parseFloat(holding.avgPrice),
      unrealizedPL: value - (parseFloat(holding.quantity) * parseFloat(holding.avgPrice))
    });
  }

  return { totalValue, holdings: assetValues };
}

async function getRecommendations(portfolioId, userId) {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  const { totalValue, holdings } = await getPortfolioStats(portfolioId, 'EUR', userId);
  const recommendations = [];

  holdings.forEach(h => {
    const concentration = (h.value / totalValue) * 100;
    if (concentration > settings.maxAssetConcentration) {
      recommendations.push({
        type: 'warning',
        severity: 'high',
        message: `${h.asset.name} represents ${concentration.toFixed(1)}% of portfolio (max: ${settings.maxAssetConcentration}%)`
      });
    }
  });

  const byType = {};
  holdings.forEach(h => {
    byType[h.asset.type] = (byType[h.asset.type] || 0) + h.value;
  });

  Object.entries(byType).forEach(([type, value]) => {
    const concentration = (value / totalValue) * 100;
    if (concentration > settings.maxCategoryConcentration) {
      recommendations.push({
        type: 'warning',
        severity: 'medium',
        message: `${type} category represents ${concentration.toFixed(1)}% (max: ${settings.maxCategoryConcentration}%)`
      });
    }
  });

  return recommendations;
}

async function getHistoryPeaks(portfolioId, currency = 'EUR', userId) {
  const portfolioIds = await getUserPortfolioIds(userId, portfolioId);

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: { in: portfolioIds } },
    include: { asset: true },
    orderBy: { date: 'asc' }
  });

  if (transactions.length === 0) {
    return { peak: null, valley: null };
  }

  const dailyValues = new Map();
  const holdings = new Map();

  for (const tx of transactions) {
    const date = tx.date.toISOString().split('T')[0];
    const key = `${tx.assetId}`;

    if (!holdings.has(key)) {
      holdings.set(key, { quantity: 0, asset: tx.asset });
    }

    const holding = holdings.get(key);
    if (tx.type === 'buy') {
      holding.quantity += parseFloat(tx.quantity);
    } else {
      holding.quantity -= parseFloat(tx.quantity);
    }

    let totalValue = 0;
    for (const [, h] of holdings) {
      if (h.quantity > 0) {
        const price = await getCurrentPrice(h.asset, currency);
        totalValue += h.quantity * price;
      }
    }

    dailyValues.set(date, totalValue);
  }

  let peak = { date: null, value: -Infinity };
  let valley = { date: null, value: Infinity };

  for (const [date, value] of dailyValues) {
    if (value > peak.value) peak = { date, value };
    if (value < valley.value) valley = { date, value };
  }

  return { peak, valley };
}

module.exports = { getPortfolioStats, getRecommendations, getHistoryPeaks, getRealizedGains, getChange24h };

async function getChange24h(userId, currency = 'EUR', portfolioId = null) {
  const portfolioIds = await getUserPortfolioIds(userId, portfolioId);

  const holdings = await prisma.holding.findMany({
    where: { portfolioId: { in: portfolioIds } },
    include: { asset: true }
  });

  if (holdings.length === 0) return null;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let currentValue = 0;
  let value24hAgo = 0;
  let assetsWithHistory = 0;
  const perAsset = [];

  for (const h of holdings) {
    const qty = parseFloat(h.quantity);
    const currentPrice = await getCurrentPrice(h.asset, currency);
    currentValue += qty * currentPrice;

    const cache24h = await prisma.priceCache.findFirst({
      where: { assetId: h.assetId, currency, timestamp: { lte: cutoff } },
      orderBy: { timestamp: 'desc' }
    });

    const price24h = cache24h ? parseFloat(cache24h.price) : currentPrice;
    if (cache24h) {
      value24hAgo += qty * price24h;
      assetsWithHistory++;
    } else {
      value24hAgo += qty * currentPrice;
    }

    perAsset.push({
      assetId: h.assetId,
      name: h.asset.name,
      symbol: h.asset.symbol,
      type: h.asset.type,
      currentPrice,
      price24h,
      changePct: price24h > 0 ? ((currentPrice - price24h) / price24h * 100) : 0,
      changeValue: qty * (currentPrice - price24h),
      currentValue: qty * currentPrice,
      hasHistory: !!cache24h
    });
  }

  if (assetsWithHistory === 0) return null;

  const changeValue = currentValue - value24hAgo;
  const changePct = value24hAgo > 0 ? (changeValue / value24hAgo * 100) : 0;
  return { changeValue, changePct, currentValue, perAsset };
}

async function getRealizedGains(portfolioId, userId) {
  const portfolioIds = await getUserPortfolioIds(userId, portfolioId);

  const transactions = await prisma.transaction.findMany({
    where: { portfolioId: { in: portfolioIds }, type: { in: ['buy', 'sell'] } },
    include: { asset: true },
    orderBy: { date: 'asc' }
  });

  const byAsset = {};

  for (const tx of transactions) {
    const key = tx.assetId;
    if (!byAsset[key]) {
      byAsset[key] = { asset: tx.asset, quantity: 0, avgCost: 0, realizedPL: 0, sellCount: 0, lastSellDate: null };
    }

    const a = byAsset[key];
    const qty = parseFloat(tx.quantity);
    const price = parseFloat(tx.pricePerUnit);
    const fees = parseFloat(tx.fees || 0);

    if (tx.type === 'buy') {
      const totalCost = a.quantity * a.avgCost + qty * price + fees;
      a.quantity += qty;
      a.avgCost = a.quantity > 0 ? totalCost / a.quantity : 0;
    } else if (tx.type === 'sell') {
      a.realizedPL += (price - a.avgCost) * qty - fees;
      a.quantity = Math.max(0, a.quantity - qty);
      a.sellCount++;
      a.lastSellDate = tx.date;
    }
  }

  const withSells = Object.values(byAsset).filter(a => a.sellCount > 0);
  const totalRealizedPL = withSells.reduce((sum, a) => sum + a.realizedPL, 0);

  return {
    totalRealizedPL,
    byAsset: withSells.map(a => ({
      asset: { symbol: a.asset.symbol, name: a.asset.name, type: a.asset.type },
      realizedPL: a.realizedPL,
      sellCount: a.sellCount,
      lastSellDate: a.lastSellDate
    }))
  };
}
