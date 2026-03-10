const statsController = {
  _portfolioFilter: '',
  _timeframe: 'all',

  async render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <style>@keyframes sk-pulse{0%,100%{opacity:.4}50%{opacity:.9}}.sk{background:var(--bg-tertiary);border-radius:6px;animation:sk-pulse 1.4s ease-in-out infinite;}</style>
      <div class="sk" style="height:52px;border-radius:8px;margin-bottom:1rem"></div>
      <div class="sk" style="height:100px;border-radius:8px;margin-bottom:1rem"></div>
      ${[1,2,3,4].map(() => `<div class="sk" style="height:80px;border-radius:8px;margin-bottom:.75rem"></div>`).join('')}
    `;

    const fr = appState.language === 'fr';
    const portfolioId = this._portfolioFilter || null;
    const is24h = this._timeframe === '24h';

    const portfolios = await api.portfolios.getAll();
    const holdings = await api.holdings.getAll(portfolioId, appState.currency || 'EUR');

    let recommendations, realizedGains, change24hData;
    if (is24h) {
      [recommendations, realizedGains, change24hData] = await Promise.all([
        api.stats.getRecommendations(portfolioId),
        api.stats.getRealizedGains(portfolioId),
        api.stats.getChange24h(appState.currency, portfolioId)
      ]);
    } else {
      [recommendations, realizedGains] = await Promise.all([
        api.stats.getRecommendations(portfolioId),
        api.stats.getRealizedGains(portfolioId)
      ]);
    }

    // --- all-time stats (needed for allocation + all-time mode) ---
    let totalValue = 0, totalCost = 0;
    const byType = {};
    holdings.forEach(h => {
      totalValue += h.currentValue;
      totalCost += parseFloat(h.quantity) * parseFloat(h.avgPrice);
      byType[h.asset.type] = (byType[h.asset.type] || 0) + h.currentValue;
    });
    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    // --- category P/L (all-time) ---
    const byCategoryPL = {};
    holdings.forEach(h => {
      const type = h.asset.type;
      if (!byCategoryPL[type]) byCategoryPL[type] = { value: 0, cost: 0 };
      byCategoryPL[type].value += h.currentValue;
      byCategoryPL[type].cost += parseFloat(h.quantity) * parseFloat(h.avgPrice);
    });

    // --- all-time performers ---
    const performers = holdings.map(h => {
      const avg = parseFloat(h.avgPrice);
      return {
        name: h.asset.name,
        pl: h.currentValue - parseFloat(h.quantity) * avg,
        plPercent: avg > 0 ? ((h.currentPrice - avg) / avg * 100) : 0
      };
    });
    const bestPercent  = [...performers].sort((a, b) => b.plPercent - a.plPercent)[0];
    const worstPercent = [...performers].sort((a, b) => a.plPercent - b.plPercent)[0];
    const bestGain     = [...performers].sort((a, b) => b.pl - a.pl)[0];
    const worstLoss    = [...performers].sort((a, b) => a.pl - b.pl)[0];

    // --- top 5 positions ---
    const topPositions = holdings.map(h => {
      const avgP = parseFloat(h.avgPrice);
      const pl = h.currentValue - parseFloat(h.quantity) * avgP;
      const plPct = avgP > 0 ? ((h.currentPrice / avgP) - 1) * 100 : 0;
      return { ...h, pl, plPct };
    }).sort((a, b) => b.currentValue - a.currentValue).slice(0, 5);

    // --- 24h mode: category change ---
    const byType24h = {};
    if (change24hData && change24hData.perAsset) {
      change24hData.perAsset.forEach(a => {
        if (!byType24h[a.type]) byType24h[a.type] = { changeValue: 0, currentValue: 0 };
        byType24h[a.type].changeValue += a.changeValue;
        byType24h[a.type].currentValue += a.currentValue;
      });
    }

    // --- 24h mode: performers ---
    const performers24h = (change24hData && change24hData.perAsset)
      ? change24hData.perAsset.filter(a => a.hasHistory)
      : [];
    const best24hPct  = [...performers24h].sort((a, b) => b.changePct - a.changePct)[0];
    const worst24hPct = [...performers24h].sort((a, b) => a.changePct - b.changePct)[0];
    const best24hVal  = [...performers24h].sort((a, b) => b.changeValue - a.changeValue)[0];
    const worst24hVal = [...performers24h].sort((a, b) => a.changeValue - b.changeValue)[0];

    // --- 24h realized gains: only sells from last 24h ---
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSells = realizedGains.byAsset.filter(a => a.lastSellDate && new Date(a.lastSellDate) >= cutoff24h);
    const realizedGainsDisplay = is24h
      ? { totalRealizedPL: recentSells.reduce((s, a) => s + a.realizedPL, 0), byAsset: recentSells }
      : realizedGains;

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c3f', 'var(--text-secondary)', 'var(--text-secondary)'];

    const tabStyle = (active) => `padding: 0.45rem 1.1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; ${active ? 'background: var(--accent); color: white;' : 'background: transparent; color: var(--text-secondary);'}`;

    app.innerHTML = `
      <!-- Filter bar -->
      <div class="card" style="padding: 0.85rem 1.25rem; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <select id="statsPortfolio" style="width: auto;">
            <option value="">${fr ? 'Tous les portefeuilles' : 'All portfolios'}</option>
            ${portfolios.map(p => `<option value="${p.id}" ${p.id === this._portfolioFilter ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
          <div style="display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden;">
            <button id="timeframeAll" style="${tabStyle(!is24h)}">${fr ? 'Depuis le début' : 'All time'}</button>
            <button id="timeframe24h" style="${tabStyle(is24h)}">24h</button>
          </div>
        </div>
      </div>

      <!-- Stat cards -->
      <div class="card">
        <h2 style="margin-bottom: 1.25rem;">${appState.t('stats.title')}${is24h ? ` <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-secondary); background: var(--bg-tertiary); padding: 0.2rem 0.6rem; border-radius: 99px; vertical-align: middle;">${fr ? '24 dernières heures' : 'Last 24 hours'}</span>` : ''}</h2>
        <div class="header-stats">
          ${is24h ? `
            <div class="stat-card">
              <div class="stat-label">${appState.t('dashboard.totalValue')}</div>
              <div class="stat-value">${appState.formatCurrency(change24hData ? change24hData.currentValue : totalValue)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${fr ? 'Variation 24h' : '24h Change'}</div>
              <div class="stat-value ${change24hData && change24hData.changeValue >= 0 ? 'positive' : 'negative'}">
                ${change24hData ? `${change24hData.changeValue >= 0 ? '+' : ''}${appState.formatCurrency(change24hData.changeValue)}` : '—'}
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${fr ? 'Variation 24h' : '24h Change'} %</div>
              <div class="stat-value ${change24hData && change24hData.changePct >= 0 ? 'positive' : 'negative'}">
                ${change24hData ? `${change24hData.changePct >= 0 ? '+' : ''}${change24hData.changePct.toFixed(2)}%` : '—'}
              </div>
            </div>
          ` : `
            <div class="stat-card">
              <div class="stat-label">${appState.t('dashboard.totalValue')}</div>
              <div class="stat-value">${appState.formatCurrency(totalValue)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${appState.t('dashboard.totalPL')}</div>
              <div class="stat-value ${totalPL >= 0 ? 'positive' : 'negative'}">${appState.formatCurrency(totalPL)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">${appState.t('dashboard.totalPL')} %</div>
              <div class="stat-value ${totalPLPercent >= 0 ? 'positive' : 'negative'}">${totalPLPercent.toFixed(2)}%</div>
            </div>
          `}
        </div>
      </div>

      <!-- Allocation chart -->
      <div class="card" style="overflow: visible;">
        <h3>${appState.t('stats.allocation')}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; overflow: visible;">
          <div style="margin: 0 auto; padding: 1rem; max-width: 100%;">
            <canvas id="allocationChart" style="max-width: 300px;"></canvas>
          </div>
          <div>
            ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, value], index) => {
              const percent = (value / totalValue * 100).toFixed(1);
              const color = COLORS[index % COLORS.length];
              return `
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <div style="width: 12px; height: 12px; border-radius: 3px; background: ${color};"></div>
                      <span style="font-weight: 600;">${appState.typeLabel(type)}</span>
                    </div>
                    <span style="font-size: 1.1rem; font-weight: bold;">${percent}%</span>
                  </div>
                  <div style="color: var(--text-secondary); font-size: 0.9rem;">${appState.formatCurrency(value)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Category P/L or 24h change by category -->
      <div class="card">
        <h3>${is24h ? (fr ? 'Variation 24h par catégorie' : '24h change by category') : appState.t('stats.categoryPL')}</h3>
        <table>
          <thead>
            <tr>
              <th>${fr ? 'Catégorie' : 'Category'}</th>
              <th>${fr ? 'Valeur actuelle' : 'Current value'}</th>
              ${is24h ? `<th>${fr ? 'Variation 24h' : '24h change'}</th><th>%</th>` : `<th>P/L</th><th>P/L %</th>`}
            </tr>
          </thead>
          <tbody>
            ${is24h
              ? Object.entries(byType24h).sort((a, b) => b[1].currentValue - a[1].currentValue).map(([type, cat], index) => {
                  const color = COLORS[index % COLORS.length];
                  const pct = cat.currentValue > 0 ? (cat.changeValue / (cat.currentValue - cat.changeValue) * 100) : 0;
                  return `
                    <tr>
                      <td><span style="display:inline-flex;align-items:center;gap:.5rem;"><span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block;flex-shrink:0;"></span>${appState.typeLabel(type)}</span></td>
                      <td>${appState.formatCurrency(cat.currentValue)}</td>
                      <td class="${cat.changeValue >= 0 ? 'positive' : 'negative'}">${cat.changeValue >= 0 ? '+' : ''}${appState.formatCurrency(cat.changeValue)}</td>
                      <td class="${pct >= 0 ? 'positive' : 'negative'}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</td>
                    </tr>
                  `;
                }).join('')
              : Object.entries(byCategoryPL).sort((a, b) => b[1].value - a[1].value).map(([type, cat], index) => {
                  const pl = cat.value - cat.cost;
                  const plPct = cat.cost > 0 ? (pl / cat.cost * 100) : 0;
                  const color = COLORS[index % COLORS.length];
                  return `
                    <tr>
                      <td><span style="display:inline-flex;align-items:center;gap:.5rem;"><span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block;flex-shrink:0;"></span>${appState.typeLabel(type)}</span></td>
                      <td>${appState.formatCurrency(cat.value)}</td>
                      <td class="${pl >= 0 ? 'positive' : 'negative'}">${appState.formatCurrency(pl)}</td>
                      <td class="${plPct >= 0 ? 'positive' : 'negative'}">${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%</td>
                    </tr>
                  `;
                }).join('')
            }
          </tbody>
        </table>
      </div>

      <!-- Performance -->
      <div class="card">
        <h3>${appState.t('stats.performance')}${is24h ? ` <span style="font-size:0.75rem;color:var(--text-secondary);">(24h)</span>` : ''}</h3>
        ${is24h ? (performers24h.length >= 2 ? `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--success);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.best')} % 24h</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--success);margin-bottom:0.25rem;">+${best24hPct.changePct.toFixed(2)}%</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${best24hPct.name}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--danger);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.worst')} % 24h</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--danger);margin-bottom:0.25rem;">${worst24hPct.changePct.toFixed(2)}%</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${worst24hPct.name}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--success);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.best')} ${appState.currency} 24h</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--success);margin-bottom:0.25rem;">+${appState.formatCurrency(best24hVal.changeValue)}</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${best24hVal.name}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--danger);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.worst')} ${appState.currency} 24h</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--danger);margin-bottom:0.25rem;">${appState.formatCurrency(worst24hVal.changeValue)}</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${worst24hVal.name}</div>
            </div>
          </div>
        ` : `<p style="color:var(--text-secondary);">${fr ? 'Pas assez de données de prix 24h.' : 'Not enough 24h price history.'}</p>`)
        : (holdings.length > 1 ? `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--success);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.best')} %</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--success);margin-bottom:0.25rem;">+${bestPercent.plPercent.toFixed(2)}%</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${bestPercent.name}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--danger);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.worst')} %</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--danger);margin-bottom:0.25rem;">${worstPercent.plPercent.toFixed(2)}%</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${worstPercent.name}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--success);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.best')} ${appState.currency}</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--success);margin-bottom:0.25rem;">${appState.formatCurrency(bestGain.pl)}</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${bestGain.name}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid var(--danger);">
              <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.5rem;">${appState.t('stats.worst')} ${appState.currency}</div>
              <div style="font-size:1.5rem;font-weight:bold;color:var(--danger);margin-bottom:0.25rem;">${appState.formatCurrency(worstLoss.pl)}</div>
              <div style="color:var(--text-secondary);font-size:0.9rem;">${worstLoss.name}</div>
            </div>
          </div>
        ` : holdings.length === 1 ? `
          <div style="background:var(--bg-tertiary);padding:1.5rem;border-radius:8px;border-left:4px solid ${bestPercent.plPercent >= 0 ? 'var(--success)' : 'var(--danger)'};">
            <div style="font-size:1.5rem;font-weight:bold;color:${bestPercent.plPercent >= 0 ? 'var(--success)' : 'var(--danger)'};margin-bottom:0.25rem;">${bestPercent.plPercent >= 0 ? '+' : ''}${bestPercent.plPercent.toFixed(2)}%</div>
            <div style="color:var(--text-secondary);font-size:0.9rem;">${bestPercent.name}</div>
          </div>
        ` : `<p style="color:var(--text-secondary);">—</p>`)}
      </div>

      <!-- Top 5 positions -->
      <div class="card">
        <h3>${appState.t('stats.topPositions')}</h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${topPositions.map((h, i) => `
            <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg-tertiary);border-radius:8px;${i===0?'border:1px solid '+RANK_COLORS[0]+'33;':''}">
              <div style="font-size:${i===0?'1.5rem':'1.1rem'};font-weight:bold;color:${RANK_COLORS[i]};width:2rem;text-align:center;flex-shrink:0;">#${i+1}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:${i===0?'1.1rem':'1rem'};">${h.asset.symbol} <span style="color:var(--text-secondary);font-weight:400;font-size:0.85rem;">${h.asset.name}</span></div>
                <div style="color:var(--text-secondary);font-size:0.85rem;margin-top:0.1rem;">${appState.typeLabel(h.asset.type)}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-weight:600;">${appState.formatCurrency(h.currentValue)}</div>
                <div class="${h.plPct>=0?'positive':'negative'}" style="font-size:0.9rem;">${h.plPct>=0?'+':''}${h.plPct.toFixed(2)}%</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Realized gains -->
      <div class="card">
        <h3>${appState.t('stats.realizedGains')}${is24h ? ` <span style="font-size:0.75rem;color:var(--text-secondary);">(${fr?'dernières 24h':'last 24h'})</span>` : ''}</h3>
        ${realizedGainsDisplay.byAsset.length === 0 ? `
          <p style="color:var(--text-secondary);">${is24h ? (fr?'Aucune vente dans les dernières 24h.':'No sells in the last 24h.') : appState.t('stats.noSells')}</p>
        ` : `
          <div style="margin-bottom:1.5rem;">
            <div style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.25rem;">${appState.t('stats.totalRealized')}</div>
            <div style="font-size:2rem;font-weight:bold;" class="${realizedGainsDisplay.totalRealizedPL>=0?'positive':'negative'}">${appState.formatCurrency(realizedGainsDisplay.totalRealizedPL)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>${fr?'Actif':'Asset'}</th>
                <th>P/L ${fr?'réalisé':'realized'}</th>
                <th>${fr?'Ventes':'Sales'}</th>
                <th>${fr?'Dernière vente':'Last sale'}</th>
              </tr>
            </thead>
            <tbody>
              ${[...realizedGainsDisplay.byAsset].sort((a,b)=>b.realizedPL-a.realizedPL).map(a=>`
                <tr>
                  <td><strong>${a.asset.symbol}</strong> <span style="color:var(--text-secondary);font-size:0.85rem;">${a.asset.name}</span></td>
                  <td class="${a.realizedPL>=0?'positive':'negative'}">${appState.formatCurrency(a.realizedPL)}</td>
                  <td>${a.sellCount}</td>
                  <td>${new Date(a.lastSellDate).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- Recommendations -->
      <div class="card">
        <h3>${appState.t('stats.recommendations')}</h3>
        ${recommendations.length > 0
          ? recommendations.map(r=>`<div class="recommendation ${r.severity}">${r.message}</div>`).join('')
          : `<p style="color:var(--text-secondary)">${appState.t('stats.noRecommendations')}</p>`}
      </div>
    `;

    // Event listeners
    document.getElementById('statsPortfolio').addEventListener('change', (e) => {
      this._portfolioFilter = e.target.value;
      this.render();
    });
    document.getElementById('timeframeAll').addEventListener('click', () => {
      if (this._timeframe !== 'all') { this._timeframe = 'all'; this.render(); }
    });
    document.getElementById('timeframe24h').addEventListener('click', () => {
      if (this._timeframe !== '24h') { this._timeframe = '24h'; this.render(); }
    });

    // Doughnut chart
    const allocCtx = document.getElementById('allocationChart');
    if (allocCtx) {
      new Chart(allocCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(byType).map(t => appState.typeLabel(t)),
          datasets: [{
            data: Object.values(byType),
            backgroundColor: COLORS,
            borderWidth: 0,
            hoverOffset: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 12,
              cornerRadius: 8,
              titleFont: { size: 14, weight: 'bold' },
              bodyFont: { size: 13 },
              callbacks: {
                label: function(context) {
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percent = ((value / total) * 100).toFixed(1);
                  return ` ${appState.formatCurrency(value)} (${percent}%)`;
                }
              }
            }
          },
          elements: {
            arc: {
              backgroundColor: (ctx) => COLORS[ctx.dataIndex % COLORS.length],
              hoverBackgroundColor: (ctx) => {
                const hover = ['#8b8dff','#4ade80','#fbbf24','#f87171','#a78bfa','#f472b6','#2dd4bf','#fb923c'];
                return hover[ctx.dataIndex % hover.length];
              }
            }
          }
        }
      });
    }
  }
};
