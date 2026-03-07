const dashboardController = {
  currentTimeframe: '30d',
  chartInstance: null,
  filterType: 'all',
  sortBy: 'value',
  sortOrder: 'desc',
  holdings: [],
  _change24hMode: 'pct',
  _change24hData: null,
  _refreshInterval: null,

  async render() {
    // Clean up tooltip from previous page
    const oldTooltip = document.getElementById('customTooltip');
    if (oldTooltip) oldTooltip.remove();

    // Clear any previous auto-refresh
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }

    const scrollPosition = window.scrollY;
    const app = document.getElementById('app');
    const [holdings, change24h] = await Promise.all([
      api.holdings.getAll('', appState.currency),
      api.stats.getChange24h(appState.currency)
    ]);
    this.holdings = holdings;

    const change24hValue = change24h?.changeValue ?? null;
    const change24hPct = change24h?.changePct ?? null;
    this._change24hData = { value: change24hValue, pct: change24hPct };
    
    let totalValue = 0;
    let totalCost = 0;
    this.holdings.forEach(h => {
      totalValue += h.currentValue;
      totalCost += parseFloat(h.quantity) * parseFloat(h.avgPrice);
    });

    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    app.innerHTML = `
      <div class="header-stats">
        <div class="stat-card">
          <div class="stat-label">${appState.t('dashboard.totalValue')}</div>
          <div class="stat-value" id="dashTotalValue">${appState.formatCurrency(totalValue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${appState.t('dashboard.totalPL')}</div>
          <div class="stat-value ${totalPL >= 0 ? 'positive' : 'negative'}" id="dashTotalPL">${appState.formatCurrency(totalPL)}</div>
          <div class="stat-sublabel ${totalPLPercent >= 0 ? 'positive' : 'negative'}" id="dashTotalPLPct">${totalPLPercent >= 0 ? '+' : ''}${totalPLPercent.toFixed(2)}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${appState.t('dashboard.totalCost')}</div>
          <div class="stat-value" id="dashTotalCost">${appState.formatCurrency(totalCost)}</div>
        </div>
        ${change24hValue !== null ? `
        <div class="stat-card" id="change24hCard" style="cursor: pointer;">
          <div class="stat-label">24h</div>
          <div class="stat-value ${change24hValue >= 0 ? 'positive' : 'negative'}" id="change24hValue">
            ${this._change24hMode === 'pct'
              ? `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`
              : `${change24hValue >= 0 ? '+' : ''}${appState.formatCurrency(change24hValue)}`}
          </div>
        </div>` : ''}
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="margin: 0;">${appState.t('dashboard.evolution')}</h2>
          <div class="timeframe-buttons">
            <button class="timeframe-btn ${this.currentTimeframe === '24h' ? 'active' : ''}" data-timeframe="24h">24h</button>
            <button class="timeframe-btn ${this.currentTimeframe === '7d' ? 'active' : ''}" data-timeframe="7d">${appState.language === 'fr' ? '7j' : '7d'}</button>
            <button class="timeframe-btn ${this.currentTimeframe === '30d' ? 'active' : ''}" data-timeframe="30d">${appState.language === 'fr' ? '30j' : '30d'}</button>
            <button class="timeframe-btn ${this.currentTimeframe === '1y' ? 'active' : ''}" data-timeframe="1y">${appState.language === 'fr' ? '1an' : '1y'}</button>
            <button class="timeframe-btn ${this.currentTimeframe === 'all' ? 'active' : ''}" data-timeframe="all">${appState.language === 'fr' ? 'Tout' : 'All'}</button>
          </div>
        </div>
        <canvas id="portfolioChart" style="max-height: 400px;"></canvas>
        <div class="timeframe-selector" id="timeframeSelector">
          <span id="currentTimeframe">${this.getTimeframeLabel()}</span>
          <span>▼</span>
        </div>
        <div class="timeframe-dropdown" id="timeframeDropdown">
          <button data-timeframe="24h" class="${this.currentTimeframe === '24h' ? 'active' : ''}">${appState.language === 'fr' ? '24 heures' : '24 hours'}</button>
          <button data-timeframe="7d" class="${this.currentTimeframe === '7d' ? 'active' : ''}">${appState.language === 'fr' ? '7 jours' : '7 days'}</button>
          <button data-timeframe="30d" class="${this.currentTimeframe === '30d' ? 'active' : ''}">${appState.language === 'fr' ? '30 jours' : '30 days'}</button>
          <button data-timeframe="1y" class="${this.currentTimeframe === '1y' ? 'active' : ''}">${appState.language === 'fr' ? '1 an' : '1 year'}</button>
          <button data-timeframe="all" class="${this.currentTimeframe === 'all' ? 'active' : ''}">${appState.language === 'fr' ? 'Tout' : 'All'}</button>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <h2 style="margin: 0;">${appState.t('dashboard.positions')}</h2>
          <select id="filterTypeDash" style="width: auto;">
            <option value="all">${appState.t('positions.filterAll')}</option>
            <option value="crypto">${appState.t('add.typeCrypto')}</option>
            <option value="stock">${appState.t('add.typeStock')}</option>
            <option value="etf">${appState.t('add.typeEtf')}</option>
            <option value="metal">${appState.t('add.typeMetal')}</option>
            <option value="cash">${appState.t('add.typeCash')}</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th style="cursor: pointer;" data-sort="name">${appState.t('dashboard.asset')} ${this.sortBy === 'name' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th style="cursor: pointer;" data-sort="quantity">${appState.t('dashboard.quantity')} ${this.sortBy === 'quantity' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th style="cursor: pointer;" data-sort="avgPrice">${appState.t('dashboard.avgPrice')} ${this.sortBy === 'avgPrice' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th style="cursor: pointer;" data-sort="currentPrice">${appState.t('dashboard.currentPrice')} ${this.sortBy === 'currentPrice' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th style="cursor: pointer;" data-sort="value">${appState.t('dashboard.value')} ${this.sortBy === 'value' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
              <th style="cursor: pointer;" data-sort="pl">${appState.t('dashboard.pl')} ${this.sortBy === 'pl' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            </tr>
          </thead>
          <tbody>
            ${this.holdings
              .filter(h => this.filterType === 'all' || h.asset.type === this.filterType)
              .sort((a, b) => {
                let comparison = 0;
                
                if (this.sortBy === 'name') {
                  comparison = a.asset.name.localeCompare(b.asset.name);
                } else if (this.sortBy === 'quantity') {
                  comparison = parseFloat(a.quantity) - parseFloat(b.quantity);
                } else if (this.sortBy === 'avgPrice') {
                  comparison = parseFloat(a.avgPrice) - parseFloat(b.avgPrice);
                } else if (this.sortBy === 'currentPrice') {
                  comparison = a.currentPrice - b.currentPrice;
                } else if (this.sortBy === 'value') {
                  comparison = a.currentValue - b.currentValue;
                } else if (this.sortBy === 'pl') {
                  const aPL = a.currentValue - (parseFloat(a.quantity) * parseFloat(a.avgPrice));
                  const bPL = b.currentValue - (parseFloat(b.quantity) * parseFloat(b.avgPrice));
                  comparison = aPL - bPL;
                } else if (this.sortBy === 'plPercent') {
                  const aAvg = parseFloat(a.avgPrice);
                  const bAvg = parseFloat(b.avgPrice);
                  const aPLPercent = aAvg > 0 ? ((a.currentPrice - aAvg) / aAvg * 100) : 0;
                  const bPLPercent = bAvg > 0 ? ((b.currentPrice - bAvg) / bAvg * 100) : 0;
                  comparison = aPLPercent - bPLPercent;
                }
                
                return this.sortOrder === 'asc' ? comparison : -comparison;
              })
              .map(h => {
              const pl = h.currentValue - (parseFloat(h.quantity) * parseFloat(h.avgPrice));
              const avgPrice = parseFloat(h.avgPrice);
              const plPercent = avgPrice > 0 ? ((h.currentPrice - avgPrice) / avgPrice * 100) : 0;
              return `
                <tr>
                  <td><strong>${h.asset.name}</strong> (${h.asset.symbol})</td>
                  <td>${parseFloat(h.quantity)}</td>
                  <td>${appState.formatCurrency(avgPrice)}</td>
                  <td>${appState.formatCurrency(h.currentPrice)}</td>
                  <td>${appState.formatCurrency(h.currentValue)}</td>
                  <td class="${pl >= 0 ? 'positive' : 'negative'}">
                    ${appState.formatCurrency(pl)} (${plPercent.toFixed(2)}%)
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.renderChart(this.holdings);
    this.setupTimeframeButtons();

    // 24h card toggle
    const card24h = document.getElementById('change24hCard');
    if (card24h) {
      card24h.addEventListener('click', () => {
        this._change24hMode = this._change24hMode === 'pct' ? 'value' : 'pct';
        const d = this._change24hData;
        document.getElementById('change24hValue').textContent =
          this._change24hMode === 'pct'
            ? `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(2)}%`
            : `${d.value >= 0 ? '+' : ''}${appState.formatCurrency(d.value)}`;
      });
    }
    
    // Set filter value
    document.getElementById('filterTypeDash').value = this.filterType;
    
    // Add filter listener
    document.getElementById('filterTypeDash').addEventListener('change', (e) => {
      this.filterType = e.target.value;
      this.updateTable();
    });
    
    // Add table header click listeners for sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', (e) => {
        e.preventDefault();
        const newSort = th.dataset.sort;
        if (this.sortBy === newSort) {
          this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortBy = newSort;
          this.sortOrder = 'desc';
        }
        this.updateTable();
      });
    });

    // Silent auto-refresh every 5 minutes
    this._refreshInterval = setInterval(() => this._silentRefresh(), 5 * 60 * 1000);
  },

  async _silentRefresh() {
    // Stop if dashboard is no longer the active view
    if (!document.getElementById('dashTotalValue')) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
      return;
    }

    try {
      const [holdings, change24h] = await Promise.all([
        api.holdings.getAll('', appState.currency),
        api.stats.getChange24h(appState.currency)
      ]);
      this.holdings = holdings;

      // Update stat cards in place
      let totalValue = 0, totalCost = 0;
      holdings.forEach(h => {
        totalValue += h.currentValue;
        totalCost += parseFloat(h.quantity) * parseFloat(h.avgPrice);
      });
      const totalPL = totalValue - totalCost;
      const totalPLPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

      document.getElementById('dashTotalValue').textContent = appState.formatCurrency(totalValue);

      const plEl = document.getElementById('dashTotalPL');
      plEl.textContent = appState.formatCurrency(totalPL);
      plEl.className = `stat-value ${totalPL >= 0 ? 'positive' : 'negative'}`;

      const plPctEl = document.getElementById('dashTotalPLPct');
      plPctEl.textContent = `${totalPLPercent >= 0 ? '+' : ''}${totalPLPercent.toFixed(2)}%`;
      plPctEl.className = `stat-sublabel ${totalPLPercent >= 0 ? 'positive' : 'negative'}`;

      document.getElementById('dashTotalCost').textContent = appState.formatCurrency(totalCost);

      // Update 24h card
      const change24hValue = change24h?.changeValue ?? null;
      const change24hPct = change24h?.changePct ?? null;
      if (change24hValue !== null) {
        this._change24hData = { value: change24hValue, pct: change24hPct };
        const valEl = document.getElementById('change24hValue');
        if (valEl) {
          valEl.textContent = this._change24hMode === 'pct'
            ? `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`
            : `${change24hValue >= 0 ? '+' : ''}${appState.formatCurrency(change24hValue)}`;
          valEl.className = `stat-value ${change24hValue >= 0 ? 'positive' : 'negative'}`;
        }
      }

      // Update table rows
      this.updateTable();

      // Re-render chart with fresh data
      await this.renderChart(this.holdings);
    } catch (e) {
      // Silent fail — user never sees this
    }
  },

  updateTable() {
    const tbody = document.querySelector('table tbody');
    const thead = document.querySelector('table thead tr');
    
    if (!tbody || !thead) return;
    
    thead.innerHTML = `
      <th style="cursor: pointer;" data-sort="name">${appState.t('dashboard.asset')} ${this.sortBy === 'name' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
      <th style="cursor: pointer;" data-sort="quantity">${appState.t('dashboard.quantity')} ${this.sortBy === 'quantity' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
      <th style="cursor: pointer;" data-sort="avgPrice">${appState.t('dashboard.avgPrice')} ${this.sortBy === 'avgPrice' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
      <th style="cursor: pointer;" data-sort="currentPrice">${appState.t('dashboard.currentPrice')} ${this.sortBy === 'currentPrice' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
      <th style="cursor: pointer;" data-sort="value">${appState.t('dashboard.value')} ${this.sortBy === 'value' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
      <th style="cursor: pointer;" data-sort="pl">${appState.t('dashboard.pl')} ${this.sortBy === 'pl' ? (this.sortOrder === 'asc' ? '▲' : '▼') : ''}</th>
    `;
    
    tbody.innerHTML = this.holdings
      .filter(h => this.filterType === 'all' || h.asset.type === this.filterType)
      .sort((a, b) => {
        let comparison = 0;
        
        if (this.sortBy === 'name') {
          comparison = a.asset.name.localeCompare(b.asset.name);
        } else if (this.sortBy === 'quantity') {
          comparison = parseFloat(a.quantity) - parseFloat(b.quantity);
        } else if (this.sortBy === 'avgPrice') {
          comparison = parseFloat(a.avgPrice) - parseFloat(b.avgPrice);
        } else if (this.sortBy === 'currentPrice') {
          comparison = a.currentPrice - b.currentPrice;
        } else if (this.sortBy === 'value') {
          comparison = a.currentValue - b.currentValue;
        } else if (this.sortBy === 'pl') {
          const aPL = a.currentValue - (parseFloat(a.quantity) * parseFloat(a.avgPrice));
          const bPL = b.currentValue - (parseFloat(b.quantity) * parseFloat(b.avgPrice));
          comparison = aPL - bPL;
        } else if (this.sortBy === 'plPercent') {
          const aAvg = parseFloat(a.avgPrice);
          const bAvg = parseFloat(b.avgPrice);
          const aPLPercent = aAvg > 0 ? ((a.currentPrice - aAvg) / aAvg * 100) : 0;
          const bPLPercent = bAvg > 0 ? ((b.currentPrice - bAvg) / bAvg * 100) : 0;
          comparison = aPLPercent - bPLPercent;
        }
        
        return this.sortOrder === 'asc' ? comparison : -comparison;
      })
      .map(h => {
        const pl = h.currentValue - (parseFloat(h.quantity) * parseFloat(h.avgPrice));
        const avgPrice = parseFloat(h.avgPrice);
        const plPercent = avgPrice > 0 ? ((h.currentPrice - avgPrice) / avgPrice * 100) : 0;
        return `
          <tr>
            <td><strong>${h.asset.name}</strong> (${h.asset.symbol})</td>
            <td>${parseFloat(h.quantity)}</td>
            <td>${appState.formatCurrency(avgPrice)}</td>
            <td>${appState.formatCurrency(h.currentPrice)}</td>
            <td>${appState.formatCurrency(h.currentValue)}</td>
            <td class="${pl >= 0 ? 'positive' : 'negative'}">
              ${appState.formatCurrency(pl)} (${plPercent.toFixed(2)}%)
            </td>
          </tr>
        `;
      }).join('');
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', (e) => {
        e.preventDefault();
        const newSort = th.dataset.sort;
        if (this.sortBy === newSort) {
          this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortBy = newSort;
          this.sortOrder = 'desc';
        }
        this.updateTable();
      });
    });
  },

  setupTimeframeButtons() {
    // Desktop buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentTimeframe = e.target.dataset.timeframe;
        this.render();
      });
    });
    
    // Mobile dropdown
    const selector = document.getElementById('timeframeSelector');
    const dropdown = document.getElementById('timeframeDropdown');
    const currentTimeframe = document.getElementById('currentTimeframe');
    
    if (selector && dropdown) {
      selector.addEventListener('click', () => {
        dropdown.classList.toggle('active');
      });
      
      document.querySelectorAll('.timeframe-dropdown button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.currentTimeframe = e.target.dataset.timeframe;
          currentTimeframe.textContent = e.target.textContent;
          dropdown.classList.remove('active');
          this.render();
        });
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!selector.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('active');
        }
      });
    }
    
    // Hide tooltip when leaving chart area
    const chartCanvas = document.getElementById('portfolioChart');
    if (chartCanvas) {
      chartCanvas.addEventListener('mouseleave', () => {
        const tooltip = document.getElementById('customTooltip');
        if (tooltip) tooltip.style.display = 'none';
      });
    }
  },

  async renderChart(holdings) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    
    // Convert hex to rgba
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    // Fetch real portfolio history
    const response = await fetch(`/api/history?timeframe=${this.currentTimeframe}&currency=${appState.currency}`);
    const historyData = await response.json();
    
    const labels = historyData.labels;
    const data = historyData.data;

    const ctx = document.getElementById('portfolioChart');
    if (ctx) {
      this.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Valeur du portefeuille',
            data,
            borderColor: accentColor,
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 400);
              gradient.addColorStop(0, hexToRgba(accentColor, 0.3));
              gradient.addColorStop(1, hexToRgba(accentColor, 0));
              return gradient;
            },
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: accentColor,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: false
            }
          },
          onHover: (event, activeElements, chart) => {
            const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
            const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
            const dataY = chart.scales.y.getValueForPixel(canvasPosition.y);
            
            if (dataX >= 0 && dataX < data.length) {
              const index = Math.round(dataX);
              const nextIndex = Math.min(index + 1, data.length - 1);
              const fraction = dataX - index;
              const interpolatedValue = data[index] + (data[nextIndex] - data[index]) * fraction;
              
              // Draw vertical line
              const ctx = chart.ctx;
              chart.draw();
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(canvasPosition.x, chart.scales.y.top);
              ctx.lineTo(canvasPosition.x, chart.scales.y.bottom);
              ctx.strokeStyle = hexToRgba(accentColor, 0.3);
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 5]);
              ctx.stroke();
              ctx.restore();
              
              // Display custom tooltip
              let tooltip = document.getElementById('customTooltip');
              if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'customTooltip';
                tooltip.style.position = 'absolute';
                tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
                tooltip.style.color = '#fff';
                tooltip.style.padding = '8px 12px';
                tooltip.style.borderRadius = '4px';
                tooltip.style.border = `1px solid ${accentColor}`;
                tooltip.style.pointerEvents = 'none';
                tooltip.style.zIndex = '1000';
                tooltip.style.fontSize = '14px';
                document.body.appendChild(tooltip);
              }
              
              const labelIndex = Math.round(dataX);
              tooltip.innerHTML = `${labels[labelIndex]}<br/><strong>${appState.formatCurrency(interpolatedValue)}</strong>`;
              tooltip.style.left = event.native.pageX + 10 + 'px';
              tooltip.style.top = event.native.pageY - 40 + 'px';
              tooltip.style.display = 'block';
            }
          },
          scales: {
            y: { 
              beginAtZero: false,
              ticks: { 
                color: '#a0a0a0',
                font: { size: 12 },
                callback: (value) => appState.formatCurrency(value, 0)
              },
              grid: { 
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false
              },
              border: { display: false }
            },
            x: {
              ticks: { 
                color: '#a0a0a0',
                font: { size: 11 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8
              },
              grid: { 
                color: 'rgba(255, 255, 255, 0.05)',
                drawBorder: false
              },
              border: { display: false }
            }
          }
        }
      });
    }
  },

  getDataPoints() {
    switch (this.currentTimeframe) {
      case '24h': return 24;
      case '7d': return 14;
      case '30d': return 30;
      case '1y': return 52;
      case 'all': return 100;
      default: return 30;
    }
  },

  getTension() {
    switch (this.currentTimeframe) {
      case '24h': return 0.2;
      case '7d': return 0.35;
      case '30d': return 0.4;
      case '1y': return 0.45;
      case 'all': return 0.5;
      default: return 0.4;
    }
  },

  getTimeframeDays() {
    switch (this.currentTimeframe) {
      case '24h': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case '1y': return 365;
      case 'all': return 730; // 2 years
      default: return 30;
    }
  },

  getTimeframeLabel() {
    const labels = {
      '24h': appState.language === 'fr' ? '24 heures' : '24 hours',
      '7d': appState.language === 'fr' ? '7 jours' : '7 days',
      '30d': appState.language === 'fr' ? '30 jours' : '30 days',
      '1y': appState.language === 'fr' ? '1 an' : '1 year',
      'all': appState.language === 'fr' ? 'Tout' : 'All'
    };
    return labels[this.currentTimeframe] || labels['30d'];
  }
};
