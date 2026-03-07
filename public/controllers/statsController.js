const statsController = {
  async render() {
    const app = document.getElementById('app');

    const [recommendations, holdings, realizedGains] = await Promise.all([
      api.stats.getRecommendations(),
      api.holdings.getAll(null, appState.currency || 'EUR'),
      api.stats.getRealizedGains()
    ]);

    let totalValue = 0;
    let totalCost = 0;
    const byType = {};

    holdings.forEach(h => {
      totalValue += h.currentValue;
      totalCost += parseFloat(h.quantity) * parseFloat(h.avgPrice);
      byType[h.asset.type] = (byType[h.asset.type] || 0) + h.currentValue;
    });

    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    // P/L by category
    const byCategoryPL = {};
    holdings.forEach(h => {
      const type = h.asset.type;
      if (!byCategoryPL[type]) byCategoryPL[type] = { value: 0, cost: 0 };
      byCategoryPL[type].value += h.currentValue;
      byCategoryPL[type].cost += parseFloat(h.quantity) * parseFloat(h.avgPrice);
    });

    // Top 5 positions sorted by value desc
    const topPositions = holdings.map(h => {
      const avgP = parseFloat(h.avgPrice);
      const pl = h.currentValue - parseFloat(h.quantity) * avgP;
      const plPct = avgP > 0 ? ((h.currentPrice / avgP) - 1) * 100 : 0;
      return { ...h, pl, plPct };
    }).sort((a, b) => b.currentValue - a.currentValue).slice(0, 5);

    // Best/worst performers
    const performers = holdings.map(h => {
      const avgPrice = parseFloat(h.avgPrice);
      const pl = h.currentValue - (parseFloat(h.quantity) * avgPrice);
      return {
        name: h.asset.name,
        pl,
        plPercent: avgPrice > 0 ? ((h.currentPrice - avgPrice) / avgPrice * 100) : 0
      };
    });

    const bestPercent = [...performers].sort((a, b) => b.plPercent - a.plPercent)[0];
    const worstPercent = [...performers].sort((a, b) => a.plPercent - b.plPercent)[0];
    const bestGain = [...performers].sort((a, b) => b.pl - a.pl)[0];
    const worstLoss = [...performers].sort((a, b) => a.pl - b.pl)[0];

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c3f', 'var(--text-secondary)', 'var(--text-secondary)'];
    const fr = appState.language === 'fr';

    app.innerHTML = `
      <div class="card">
        <h2>${appState.t('stats.title')}</h2>
        <div class="header-stats">
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
        </div>
      </div>

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
                <div style="margin-bottom: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; overflow: hidden;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <div style="width: 12px; height: 12px; border-radius: 3px; background: ${color};"></div>
                      <span style="font-weight: 600; text-transform: capitalize;">${type}</span>
                    </div>
                    <span style="font-size: 1.1rem; font-weight: bold;">${percent}%</span>
                  </div>
                  <div style="color: var(--text-secondary); font-size: 0.9rem;">
                    <span>${appState.formatCurrency(value)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <h3>${appState.t('stats.categoryPL')}</h3>
        <table>
          <thead>
            <tr>
              <th>${fr ? 'Catégorie' : 'Category'}</th>
              <th>${fr ? 'Valeur' : 'Value'}</th>
              <th>P/L</th>
              <th>P/L %</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(byCategoryPL).sort((a, b) => b[1].value - a[1].value).map(([type, cat], index) => {
              const pl = cat.value - cat.cost;
              const plPct = cat.cost > 0 ? (pl / cat.cost * 100) : 0;
              const color = COLORS[index % COLORS.length];
              return `
                <tr>
                  <td>
                    <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
                      <span style="width: 10px; height: 10px; border-radius: 2px; background: ${color}; display: inline-block; flex-shrink: 0;"></span>
                      <span style="text-transform: capitalize;">${type}</span>
                    </span>
                  </td>
                  <td>${appState.formatCurrency(cat.value)}</td>
                  <td class="${pl >= 0 ? 'positive' : 'negative'}">${appState.formatCurrency(pl)}</td>
                  <td class="${plPct >= 0 ? 'positive' : 'negative'}">${plPct >= 0 ? '+' : ''}${plPct.toFixed(2)}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>${appState.t('stats.performance')}</h3>
        ${holdings.length > 1 ? `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px; border-left: 4px solid var(--success);">
              <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">${appState.t('stats.best')} %</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--success); margin-bottom: 0.25rem;">+${bestPercent.plPercent.toFixed(2)}%</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">${bestPercent.name}</div>
            </div>
            <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px; border-left: 4px solid var(--danger);">
              <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">${appState.t('stats.worst')} %</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--danger); margin-bottom: 0.25rem;">${worstPercent.plPercent.toFixed(2)}%</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">${worstPercent.name}</div>
            </div>
            <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px; border-left: 4px solid var(--success);">
              <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">${appState.t('stats.best')} ${appState.currency}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--success); margin-bottom: 0.25rem;">${appState.formatCurrency(bestGain.pl)}</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">${bestGain.name}</div>
            </div>
            <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px; border-left: 4px solid var(--danger);">
              <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">${appState.t('stats.worst')} ${appState.currency}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--danger); margin-bottom: 0.25rem;">${appState.formatCurrency(worstLoss.pl)}</div>
              <div style="color: var(--text-secondary); font-size: 0.9rem;">${worstLoss.name}</div>
            </div>
          </div>
        ` : holdings.length === 1 ? `
          <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px; border-left: 4px solid ${bestPercent.plPercent >= 0 ? 'var(--success)' : 'var(--danger)'};">
            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">${appState.t('stats.performance')}</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: ${bestPercent.plPercent >= 0 ? 'var(--success)' : 'var(--danger)'}; margin-bottom: 0.25rem;">${bestPercent.plPercent >= 0 ? '+' : ''}${bestPercent.plPercent.toFixed(2)}%</div>
            <div style="color: var(--text-secondary); font-size: 0.9rem;">${bestPercent.name}</div>
          </div>
        ` : `<p style="color: var(--text-secondary);">—</p>`}
      </div>

      <div class="card">
        <h3>${appState.t('stats.topPositions')}</h3>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${topPositions.map((h, i) => `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; ${i === 0 ? 'border: 1px solid ' + RANK_COLORS[0] + '33;' : ''}">
              <div style="font-size: ${i === 0 ? '1.5rem' : '1.1rem'}; font-weight: bold; color: ${RANK_COLORS[i]}; width: 2rem; text-align: center; flex-shrink: 0;">#${i + 1}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: ${i === 0 ? '1.1rem' : '1rem'};">${h.asset.symbol} <span style="color: var(--text-secondary); font-weight: 400; font-size: 0.85rem;">${h.asset.name}</span></div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.1rem; text-transform: capitalize;">${h.asset.type}</div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                <div style="font-weight: 600;">${appState.formatCurrency(h.currentValue)}</div>
                <div class="${h.plPct >= 0 ? 'positive' : 'negative'}" style="font-size: 0.9rem;">${h.plPct >= 0 ? '+' : ''}${h.plPct.toFixed(2)}%</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <h3>${appState.t('stats.realizedGains')}</h3>
        ${realizedGains.byAsset.length === 0 ? `
          <p style="color: var(--text-secondary);">${appState.t('stats.noSells')}</p>
        ` : `
          <div style="margin-bottom: 1.5rem;">
            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.25rem;">${appState.t('stats.totalRealized')}</div>
            <div style="font-size: 2rem; font-weight: bold;" class="${realizedGains.totalRealizedPL >= 0 ? 'positive' : 'negative'}">${appState.formatCurrency(realizedGains.totalRealizedPL)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>${fr ? 'Actif' : 'Asset'}</th>
                <th>P/L ${fr ? 'réalisé' : 'realized'}</th>
                <th>${fr ? 'Ventes' : 'Sales'}</th>
                <th>${fr ? 'Dernière vente' : 'Last sale'}</th>
              </tr>
            </thead>
            <tbody>
              ${[...realizedGains.byAsset].sort((a, b) => b.realizedPL - a.realizedPL).map(a => `
                <tr>
                  <td><strong>${a.asset.symbol}</strong> <span style="color: var(--text-secondary); font-size: 0.85rem;">${a.asset.name}</span></td>
                  <td class="${a.realizedPL >= 0 ? 'positive' : 'negative'}">${appState.formatCurrency(a.realizedPL)}</td>
                  <td>${a.sellCount}</td>
                  <td>${new Date(a.lastSellDate).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <div class="card">
        <h3>${appState.t('stats.recommendations')}</h3>
        ${recommendations.length > 0 ? recommendations.map(r => `
          <div class="recommendation ${r.severity}">${r.message}</div>
        `).join('') : `<p style="color: var(--text-secondary)">${appState.t('stats.noRecommendations')}</p>`}
      </div>
    `;

    // Doughnut chart
    const allocCtx = document.getElementById('allocationChart');
    if (allocCtx) {
      new Chart(allocCtx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(byType).map(t => t.charAt(0).toUpperCase() + t.slice(1)),
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
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
                const hover = ['#8b8dff', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c'];
                return hover[ctx.dataIndex % hover.length];
              }
            }
          }
        }
      });
    }
  }
};
