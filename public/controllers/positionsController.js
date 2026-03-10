const positionsController = {
  filterType: 'all',
  sortBy: 'value',
  searchQuery: '',
  _assetsWithTransactions: null,
  _portfolios: null,
  _visibleCount: 50,
  _menuCloseHandler: null,
  _addTxAssetId: null,

  async render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <style>
        @keyframes sk-pulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        .sk { background:var(--bg-tertiary); border-radius:6px; animation:sk-pulse 1.4s ease-in-out infinite; }
        .menu-item:hover { background: var(--bg-primary) !important; }
      </style>
      <div class="sk" style="height:44px;border-radius:8px;margin-bottom:1rem"></div>
      ${[1,2,3,4,5,6,7,8].map(() => `<div class="sk" style="height:62px;border-radius:8px;margin-bottom:.5rem"></div>`).join('')}
    `;

    const holdings = await api.holdings.getAll('', appState.currency);
    const transactions = await api.transactions.getAll();
    const portfolios = await api.portfolios.getAll();

    this._portfolios = portfolios;

    // Group all assets that have transactions (even if holding is 0)
    const assetsWithTransactions = new Map();

    transactions.forEach(t => {
      const key = `${t.portfolioId}-${t.assetId}`;
      if (!assetsWithTransactions.has(key)) {
        const portfolio = portfolios.find(p => p.id === t.portfolioId);
        assetsWithTransactions.set(key, {
          asset: t.asset,
          portfolioId: t.portfolioId,
          portfolioName: portfolio ? portfolio.name : 'Unknown',
          assetId: t.assetId,
          transactions: [],
          holding: null
        });
      }
      assetsWithTransactions.get(key).transactions.push(t);
    });

    // Merge with current holdings
    holdings.forEach(h => {
      const key = `${h.portfolioId}-${h.assetId}`;
      const portfolio = portfolios.find(p => p.id === h.portfolioId);
      if (assetsWithTransactions.has(key)) {
        assetsWithTransactions.get(key).holding = h;
        assetsWithTransactions.get(key).portfolioName = portfolio ? portfolio.name : 'Unknown';
      } else {
        assetsWithTransactions.set(key, {
          asset: h.asset,
          portfolioId: h.portfolioId,
          portfolioName: portfolio ? portfolio.name : 'Unknown',
          assetId: h.assetId,
          holding: h,
          transactions: transactions.filter(t => t.assetId === h.assetId && t.portfolioId === h.portfolioId)
        });
      }
    });

    this._assetsWithTransactions = assetsWithTransactions;
    this._buildList();
  },

  // Renders the list from cached data — no API calls. Called by filter/sort/search changes.
  _buildList() {
    const app = document.getElementById('app');
    if (!this._assetsWithTransactions) return;

    const items = Array.from(this._assetsWithTransactions.values())
      .filter(item => {
        const matchType = this.filterType === 'all' || item.asset.type === this.filterType;
        const matchSearch = !this.searchQuery ||
          item.asset.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          item.asset.symbol.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          item.portfolioName.toLowerCase().includes(this.searchQuery.toLowerCase());
        return matchType && matchSearch;
      })
      .sort((a, b) => {
        const aHolding = a.holding;
        const bHolding = b.holding;

        if (this.sortBy === 'name') {
          return a.asset.name.localeCompare(b.asset.name);
        } else if (this.sortBy === 'value') {
          const aValue = aHolding ? aHolding.currentValue : 0;
          const bValue = bHolding ? bHolding.currentValue : 0;
          return bValue - aValue;
        } else if (this.sortBy === 'pl') {
          const aPL = aHolding ? aHolding.currentValue - (parseFloat(aHolding.quantity) * parseFloat(aHolding.avgPrice)) : 0;
          const bPL = bHolding ? bHolding.currentValue - (parseFloat(bHolding.quantity) * parseFloat(bHolding.avgPrice)) : 0;
          return bPL - aPL;
        } else if (this.sortBy === 'plPercent') {
          const aAvg = aHolding ? parseFloat(aHolding.avgPrice) : 0;
          const bAvg = bHolding ? parseFloat(bHolding.avgPrice) : 0;
          const aPLPercent = aHolding && aAvg > 0 ? ((aHolding.currentPrice - aAvg) / aAvg * 100) : 0;
          const bPLPercent = bHolding && bAvg > 0 ? ((bHolding.currentPrice - bAvg) / bAvg * 100) : 0;
          return bPLPercent - aPLPercent;
        }
        return 0;
      });

    app.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <h2 style="margin: 0;">${appState.t('positions.title')}</h2>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <input type="text" id="searchPositions" placeholder="${appState.language === 'fr' ? 'Rechercher...' : 'Search...'}" style="width: 200px;" value="${this.searchQuery}">
            <select id="filterType" style="width: auto;">
              <option value="all">${appState.t('positions.filterAll')}</option>
              <option value="crypto">${appState.t('add.typeCrypto')}</option>
              <option value="stock">${appState.t('add.typeStock')}</option>
              <option value="etf">${appState.t('add.typeEtf')}</option>
              <option value="metal">${appState.t('add.typeMetal')}</option>
              <option value="cash">${appState.t('add.typeCash')}</option>
              <option value="cs2skin">${appState.t('add.typeCs2skin')}</option>
            </select>
            <select id="sortBy" style="width: auto;">
              <option value="name">${appState.t('positions.sortName')}</option>
              <option value="value">${appState.t('positions.sortValue')}</option>
              <option value="pl">${appState.t('positions.sortPL')}</option>
              <option value="plPercent">${appState.t('positions.sortPLPercent')}</option>
            </select>
          </div>
        </div>
        ${items.slice(0, this._visibleCount).map(item => {
          const h = item.holding;
          const assetTransactions = item.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
          const buyTxCount = item.transactions.filter(t => t.type === 'buy').length;

          let avgPrice = 0;
          let quantity = 0;
          let currentValue = 0;
          let currentPrice = 0;

          if (h) {
            avgPrice = parseFloat(h.avgPrice);
            quantity = parseFloat(h.quantity);
            currentValue = h.currentValue;
            currentPrice = h.currentPrice;
          } else {
            let totalCost = 0;
            let totalQty = 0;
            assetTransactions.forEach(t => {
              if (t.type === 'buy') {
                totalCost += parseFloat(t.quantity) * parseFloat(t.pricePerUnit);
                totalQty += parseFloat(t.quantity);
              }
            });
            avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
          }

          const pl = currentValue - (quantity * avgPrice);
          const plPercent = avgPrice > 0 && quantity > 0 ? ((currentPrice - avgPrice) / avgPrice * 100) : 0;
          const key = `${item.portfolioId}-${item.assetId}`;

          return `
            <div style="margin-bottom: 2rem; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
              <div style="background: var(--bg-tertiary); padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; cursor: pointer;" onclick="positionsController.toggleTransactions('${key}')">
                <div style="flex: 1; display: flex; align-items: center; gap: 1rem;">
                  <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: white; flex-shrink: 0;">
                    ${item.asset.symbol.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 style="margin: 0;">${item.asset.name} (${item.asset.symbol})</h3>
                    <div style="color: var(--text-secondary); margin-top: 0.25rem;">
                      <strong>${item.portfolioName}</strong>${quantity > 0 ? ` • ${quantity} × ${appState.formatCurrency(currentPrice)} = ${appState.formatCurrency(currentValue)}` : ` • ${appState.t('positions.soldOut')}`}
                    </div>
                    ${quantity > 0 ? `<div style="color: var(--text-secondary); font-size: 0.82rem; margin-top: 0.15rem;">${appState.language === 'fr' ? 'Coût' : 'Cost'}: ${quantity} × ${appState.formatCurrency(avgPrice)} = ${appState.formatCurrency(quantity * avgPrice)}</div>` : ''}
                  </div>
                </div>
                ${quantity > 0 ? `
                  <div style="text-align: right;">
                    <div style="display: inline-block; padding: 0.35rem 0.85rem; border-radius: 8px; background: ${pl >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}; border: 1px solid ${pl >= 0 ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}; margin-bottom: 0.3rem; width: 165px; text-align: center;">
                      <div class="${pl >= 0 ? 'positive' : 'negative'}" style="font-size: 1.25rem; font-weight: bold; line-height: 1.2;">
                        ${pl >= 0 ? '+' : ''}${appState.formatCurrency(pl)}
                      </div>
                      <div class="${pl >= 0 ? 'positive' : 'negative'}" style="font-size: 0.88rem; font-weight: 600;">${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(2)}%</div>
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.1rem;">${appState.t('positions.currentPrice')}: ${appState.formatCurrency(currentPrice)}</div>
                  </div>
                  <div style="position: relative;" onclick="event.stopPropagation();" data-menu>
                    <button onclick="positionsController.toggleMenu('${key}')" data-menu data-menu-key="${key}" style="background: var(--bg-secondary); border: 1px solid var(--border); width: 36px; height: 36px; border-radius: 8px; font-size: 1.3rem; padding: 0; cursor: pointer; color: var(--text-secondary);">⋮</button>
                    <div id="menu-${key}" data-menu style="display: none; position: absolute; right: 0; top: calc(100% + 4px); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; min-width: 170px; z-index: 200; box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow: hidden;">
                      <button class="menu-item" data-menu onclick="positionsController.addTransaction('${item.assetId}', '${item.portfolioId}', '${item.asset.name.replace(/'/g, "\\'")}', '${item.asset.symbol.replace(/'/g, "\\'")}')" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border);padding:0.65rem 1rem;cursor:pointer;color:#4ade80;font-size:0.88rem;display:flex;align-items:center;gap:0.6rem;"><span>＋</span>${appState.t('positions.addTransaction')}</button>
                      <button class="menu-item" data-menu onclick="positionsController.sellPosition('${h.id}', '${item.assetId}', '${item.asset.name}', '${item.asset.symbol}', ${quantity}, ${avgPrice}, '${item.portfolioId}')" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border);padding:0.65rem 1rem;cursor:pointer;color:var(--warning);font-size:0.88rem;display:flex;align-items:center;gap:0.6rem;"><span>↓</span>${appState.t('positions.sell')}</button>
                      ${buyTxCount <= 1
                        ? `<button class="menu-item" data-menu onclick="positionsController.editPosition('${h.id}', '${item.asset.name}', ${quantity}, ${avgPrice}, '${item.portfolioId}')" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border);padding:0.65rem 1rem;cursor:pointer;color:var(--text-primary);font-size:0.88rem;display:flex;align-items:center;gap:0.6rem;"><span>✎</span>${appState.t('positions.edit')}</button>`
                        : `<button class="menu-item" data-menu onclick="positionsController.toggleTransactions('${key}')" title="${appState.language === 'fr' ? 'Modifier les transactions individuelles' : 'Edit individual transactions'}" style="width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--border);padding:0.65rem 1rem;cursor:pointer;color:var(--text-primary);font-size:0.88rem;display:flex;align-items:center;gap:0.6rem;"><span>✎</span>${appState.t('positions.edit')}</button>`
                      }
                      <button class="menu-item" data-menu onclick="positionsController.deletePosition('${h.id}', '${item.asset.name}')" style="width:100%;text-align:left;background:none;border:none;padding:0.65rem 1rem;cursor:pointer;color:var(--danger);font-size:0.88rem;display:flex;align-items:center;gap:0.6rem;"><span>✕</span>${appState.t('positions.delete')}</button>
                    </div>
                  </div>
                ` : ''}
              </div>
              ${assetTransactions.length > 0 ? `
                <div id="transactions-${key}" class="tx-panel" style="display: none;"></div>
              ` : ''}
            </div>
          `;
        }).join('')}
        ${items.length > this._visibleCount ? `
          <div style="text-align: center; padding: 1.25rem 0 0.5rem; color: var(--text-secondary); font-size: 0.87rem;">
            ${this._visibleCount} / ${items.length} &nbsp;—&nbsp;
            <button id="loadMoreBtn" type="button" style="background: transparent; border: 1px solid var(--border); padding: 0.4rem 1.2rem; border-radius: 6px; cursor: pointer; color: var(--text-primary); font-size: 0.87rem;">
              ${appState.language === 'fr' ? `Voir ${Math.min(50, items.length - this._visibleCount)} de plus` : `Show ${Math.min(50, items.length - this._visibleCount)} more`}
            </button>
          </div>
        ` : (items.length > 0 && this._visibleCount > 50 ? `
          <div style="text-align: center; padding: 0.75rem; color: var(--text-secondary); font-size: 0.87rem;">${items.length} ${appState.language === 'fr' ? 'positions' : 'positions'}</div>
        ` : '')}
      </div>

      <div id="editModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; padding: 1rem; overflow-y: auto;">
        <div style="position: relative; max-width: 500px; margin: 2rem auto; background: var(--bg-secondary); padding: 2rem; border-radius: 12px; border: 1px solid var(--border);">
          <h3 style="margin-bottom: 1.5rem;">${appState.t('edit.position')}</h3>
          <form id="editForm">
            <div class="form-group">
              <label>${appState.t('edit.portfolio')}</label>
              <select name="portfolioId" id="editPortfolioId" required>
              </select>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.quantity')}</label>
              <input type="number" step="0.00000001" name="quantity" id="editQuantity" required>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.avgPrice')}</label>
              <input type="number" step="0.01" name="avgPrice" id="editAvgPrice" required>
            </div>
            <input type="hidden" name="holdingId" id="editHoldingId">
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="submit" style="flex: 1;">${appState.t('edit.save')}</button>
              <button type="button" onclick="positionsController.closeModal()" style="flex: 1; background: var(--bg-tertiary);">${appState.t('confirm.cancel')}</button>
            </div>
          </form>
        </div>
      </div>

      <div id="editTransactionModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; padding: 1rem; overflow-y: auto;">
        <div style="position: relative; max-width: 500px; margin: 2rem auto; background: var(--bg-secondary); padding: 2rem; border-radius: 12px; border: 1px solid var(--border);">
          <h3 style="margin-bottom: 1.5rem;">${appState.t('edit.transaction')}</h3>
          <form id="editTransactionForm">
            <div class="form-group">
              <label>${appState.t('edit.type')}</label>
              <select name="type" id="editTxType" required>
                <option value="buy">${appState.t('positions.buy')}</option>
                <option value="sell">${appState.t('positions.sell')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.quantity')}</label>
              <input type="number" step="0.00000001" name="quantity" id="editTxQuantity" required>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.pricePerUnit')}</label>
              <input type="number" step="0.01" name="pricePerUnit" id="editTxPrice" required>
            </div>
            <div class="form-group">
              <label>${appState.t('positions.fees')}</label>
              <input type="number" step="0.01" name="fees" id="editTxFees" required>
            </div>
            <div class="form-group">
              <label>${appState.t('positions.date')}</label>
              <input type="datetime-local" name="date" id="editTxDate" required>
            </div>
            <input type="hidden" name="transactionId" id="editTransactionId">
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="submit" style="flex: 1;">${appState.t('edit.save')}</button>
              <button type="button" onclick="positionsController.closeTransactionModal()" style="flex: 1; background: var(--bg-tertiary);">${appState.t('confirm.cancel')}</button>
            </div>
          </form>
        </div>
      </div>

      <div id="sellModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; padding: 1rem; overflow-y: auto;">
        <div style="position: relative; max-width: 500px; margin: 2rem auto; background: var(--bg-secondary); padding: 2rem; border-radius: 12px; border: 1px solid var(--border);">
          <h3 style="margin-bottom: 1.5rem;">${appState.t('positions.sellTitle')}</h3>
          <div id="sellInfo" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem;"></div>
          <form id="sellForm">
            <div class="form-group">
              <label>${appState.t('edit.quantity')}</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="number" step="any" name="quantity" id="sellQuantity" required style="flex: 1;">
                <button type="button" id="sellMaxBtn" style="padding: 0.75rem 1rem; background: var(--bg-tertiary);">${appState.t('positions.max')}</button>
              </div>
              <small id="maxQuantity" style="color: var(--text-secondary);"></small>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.pricePerUnit')}</label>
              <input type="number" step="0.01" name="pricePerUnit" id="sellPrice" placeholder="${appState.t('add.pricePlaceholder')}">
            </div>
            <div class="form-group">
              <label>${appState.t('positions.fees')}</label>
              <input type="number" step="0.01" name="fees" id="sellFees" value="0">
            </div>
            <div class="form-group">
              <label>${appState.t('positions.date')}</label>
              <input type="datetime-local" name="date" id="sellDate" required>
            </div>
            <div id="profitPreview" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; display: none;"></div>
            <input type="hidden" name="assetId" id="sellAssetId">
            <input type="hidden" name="portfolioId" id="sellPortfolioId">
            <input type="hidden" name="avgPrice" id="sellAvgPrice">
            <input type="hidden" name="maxQty" id="sellMaxQty">
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="submit" style="flex: 1; background: var(--warning);">${appState.t('positions.sell')}</button>
              <button type="button" onclick="positionsController.closeSellModal()" style="flex: 1; background: var(--bg-tertiary);">${appState.t('confirm.cancel')}</button>
            </div>
          </form>
        </div>
      </div>

      <div id="addTransactionModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000; padding: 1rem; overflow-y: auto;">
        <div style="position: relative; max-width: 500px; margin: 2rem auto; background: var(--bg-secondary); padding: 2rem; border-radius: 12px; border: 1px solid var(--border);">
          <h3 style="margin-bottom: 0.5rem;" id="addTransactionTitle">${appState.t('positions.addTransactionTitle')}</h3>
          <div id="addTransactionInfo" style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;"></div>
          <form id="addTransactionForm">
            <div class="form-group">
              <label>${appState.t('edit.type')}</label>
              <select name="type" id="addTxType" required>
                <option value="buy">${appState.t('positions.buy')}</option>
                <option value="sell">${appState.t('positions.sell')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.quantity')}</label>
              <input type="number" step="0.00000001" name="quantity" id="addTxQuantity" required>
            </div>
            <div class="form-group">
              <label>${appState.t('edit.pricePerUnit')}</label>
              <input type="number" step="0.01" name="pricePerUnit" id="addTxPrice" placeholder="${appState.t('add.pricePlaceholder')}">
            </div>
            <div class="form-group">
              <label>${appState.t('positions.fees')}</label>
              <input type="number" step="0.01" name="fees" id="addTxFees" value="0">
            </div>
            <div class="form-group">
              <label>${appState.t('positions.date')}</label>
              <input type="datetime-local" name="date" id="addTxDate" required>
            </div>
            <input type="hidden" name="assetId" id="addTxAssetId">
            <input type="hidden" name="portfolioId" id="addTxPortfolioId">
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="submit" style="flex: 1;">${appState.t('edit.save')}</button>
              <button type="button" onclick="positionsController.closeAddTransactionModal()" style="flex: 1; background: var(--bg-tertiary);">${appState.t('confirm.cancel')}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.setupEventListeners();

    // Close kebab menus when clicking outside or on a menu action
    if (this._menuCloseHandler) document.removeEventListener('click', this._menuCloseHandler, true);
    this._menuCloseHandler = (e) => {
      const isMenuAction = e.target.closest('.menu-item');
      const isInsideMenu = e.target.closest('[data-menu]');
      if (!isInsideMenu || isMenuAction) {
        document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none');
      }
    };
    document.addEventListener('click', this._menuCloseHandler, true);

    // Load more button (pagination)
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this._visibleCount += 50;
        const scrollPos = window.scrollY;
        this._buildList();
        window.scrollTo(0, scrollPos);
      });
    }

    // Restore filter and sort state
    document.getElementById('filterType').value = this.filterType;
    document.getElementById('sortBy').value = this.sortBy;

    // Search: re-filter from cache, no API call
    let searchTimeout;
    document.getElementById('searchPositions').addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const scrollPos = window.scrollY;
        this._visibleCount = 50;
        this._buildList();
        window.scrollTo(0, scrollPos);
        const searchInput = document.getElementById('searchPositions');
        if (searchInput) {
          searchInput.focus();
          const len = searchInput.value.length;
          searchInput.setSelectionRange(len, len);
        }
      }, 300);
    });

    // Filter/sort: re-render from cache, no API call
    document.getElementById('filterType').addEventListener('change', (e) => {
      this.filterType = e.target.value;
      this._visibleCount = 50;
      this._buildList();
    });

    document.getElementById('sortBy').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this._visibleCount = 50;
      this._buildList();
    });
  },

  setupEventListeners() {
    const form = document.getElementById('editForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
          await api.put(`/holdings/${data.holdingId}`, {
            portfolioId: data.portfolioId,
            quantity: parseFloat(data.quantity),
            avgPrice: parseFloat(data.avgPrice)
          });
          this.closeModal();
          this.render();
        } catch (error) {
          alert('Erreur: ' + error.message);
        }
      });
    }

    const sellForm = document.getElementById('sellForm');
    if (sellForm) {
      document.getElementById('sellMaxBtn').addEventListener('click', () => {
        const maxQty = document.getElementById('sellMaxQty').value;
        document.getElementById('sellQuantity').value = maxQty;
        this.updateProfitPreview();
      });

      sellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        const maxQty = parseFloat(data.maxQty);
        const sellQty = parseFloat(data.quantity);

        if (sellQty > maxQty) {
          alert(`${appState.t('positions.cannotSellMore')} ${maxQty}`);
          return;
        }

        try {
          const scrollPos = window.scrollY;
          await api.transactions.create({
            portfolioId: data.portfolioId,
            assetId: data.assetId,
            type: 'sell',
            quantity: sellQty,
            pricePerUnit: data.pricePerUnit ? parseFloat(data.pricePerUnit) : undefined,
            fees: parseFloat(data.fees) || 0,
            date: data.date,
            currency: appState.currency
          });
          await api.post('/sync', {});
          this.closeSellModal();
          await this.render();
          window.scrollTo(0, scrollPos);
        } catch (error) {
          alert('Erreur: ' + error.message);
        }
      });

      document.getElementById('sellPrice').addEventListener('input', () => {
        this.updateProfitPreview();
      });
      document.getElementById('sellQuantity').addEventListener('input', () => {
        this.updateProfitPreview();
      });
    }

    const txForm = document.getElementById('editTransactionForm');
    if (txForm) {
      txForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
          const scrollPos = window.scrollY;
          await api.put(`/transactions/${data.transactionId}`, {
            type: data.type,
            quantity: parseFloat(data.quantity),
            pricePerUnit: parseFloat(data.pricePerUnit),
            fees: parseFloat(data.fees),
            date: data.date
          });
          await api.post('/sync', {});
          this.closeTransactionModal();
          await this.render();
          window.scrollTo(0, scrollPos);
        } catch (error) {
          alert('Erreur: ' + error.message);
        }
      });
    }

    const addTxForm = document.getElementById('addTransactionForm');
    if (addTxForm) {
      addTxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
          const scrollPos = window.scrollY;
          await api.transactions.create({
            portfolioId: data.portfolioId,
            assetId: data.assetId,
            type: data.type,
            quantity: parseFloat(data.quantity),
            pricePerUnit: data.pricePerUnit ? parseFloat(data.pricePerUnit) : 0,
            fees: parseFloat(data.fees) || 0,
            date: data.date,
            currency: appState.currency
          });
          await api.post('/sync', {});
          this.closeAddTransactionModal();
          await this.render();
          window.scrollTo(0, scrollPos);
        } catch (error) {
          alert('Erreur: ' + error.message);
        }
      });
    }

    // Debounced date change: fetch historical price automatically
    const addTxDate = document.getElementById('addTxDate');
    if (addTxDate) {
      let dateDebounce;
      addTxDate.addEventListener('change', () => {
        if (!this._addTxAssetId) return;
        clearTimeout(dateDebounce);
        const priceInput = document.getElementById('addTxPrice');
        if (priceInput) priceInput.placeholder = '…';
        dateDebounce = setTimeout(async () => {
          const date = addTxDate.value;
          if (!date || !this._addTxAssetId) return;
          try {
            const data = await api.assets.getHistoricalPrice(this._addTxAssetId, date, appState.currency);
            if (priceInput) {
              priceInput.placeholder = appState.t('add.pricePlaceholder');
              if (data?.price > 0) priceInput.value = data.price;
            }
          } catch (e) {
            if (priceInput) priceInput.placeholder = appState.t('add.pricePlaceholder');
          }
        }, 800);
      });
    }
  },

  editPosition(id, name, quantity, avgPrice, portfolioId) {
    const portfolios = this._portfolios || [];
    const select = document.getElementById('editPortfolioId');
    select.innerHTML = portfolios.map(p =>
      `<option value="${p.id}" ${p.id === portfolioId ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    document.getElementById('editHoldingId').value = id;
    document.getElementById('editQuantity').value = quantity;
    document.getElementById('editAvgPrice').value = avgPrice;
    document.getElementById('editModal').style.display = 'block';
  },

  closeModal() {
    document.getElementById('editModal').style.display = 'none';
  },

  closeTransactionModal() {
    document.getElementById('editTransactionModal').style.display = 'none';
  },

  sellPosition(holdingId, assetId, assetName, assetSymbol, quantity, avgPrice, portfolioId) {
    document.getElementById('sellAssetId').value = assetId;
    document.getElementById('sellPortfolioId').value = portfolioId;
    document.getElementById('sellAvgPrice').value = avgPrice;
    document.getElementById('sellMaxQty').value = quantity;
    document.getElementById('sellQuantity').max = quantity;
    document.getElementById('maxQuantity').textContent = `Max: ${parseFloat(quantity)} ${assetSymbol}`;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('sellDate').value = now.toISOString().slice(0, 16);

    document.getElementById('sellInfo').innerHTML = `
      <strong>${assetName} (${assetSymbol})</strong><br/>
      ${appState.t('dashboard.quantity')}: ${parseFloat(quantity)}<br/>
      ${appState.t('dashboard.avgPrice')}: ${appState.formatCurrency(parseFloat(avgPrice))}
    `;

    document.getElementById('sellModal').style.display = 'block';
  },

  closeSellModal() {
    document.getElementById('sellModal').style.display = 'none';
  },

  addTransaction(assetId, portfolioId, assetName, assetSymbol) {
    this._addTxAssetId = assetId;
    document.getElementById('addTxAssetId').value = assetId;
    document.getElementById('addTxPortfolioId').value = portfolioId;
    document.getElementById('addTxQuantity').value = '';
    document.getElementById('addTxPrice').value = '';
    document.getElementById('addTxFees').value = '0';
    document.getElementById('addTxType').value = 'buy';
    document.getElementById('addTransactionInfo').textContent = `${assetName} (${assetSymbol})`;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('addTxDate').value = now.toISOString().slice(0, 16);

    document.getElementById('addTransactionModal').style.display = 'block';

    // Auto-fill current price in background
    api.assets.getPrice(assetId, appState.currency).then(data => {
      if (data?.price > 0) {
        document.getElementById('addTxPrice').value = data.price;
      }
    }).catch(() => {});
  },

  closeAddTransactionModal() {
    document.getElementById('addTransactionModal').style.display = 'none';
  },

  toggleMenu(key) {
    const menu = document.getElementById(`menu-${key}`);
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    document.querySelectorAll('[id^="menu-"]').forEach(m => m.style.display = 'none');
    if (!isOpen) {
      const btn = document.querySelector(`[data-menu-key="${key}"]`);
      if (btn) {
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;
        menu.style.left = 'auto';
      }
      menu.style.display = 'block';
    }
  },

  updateProfitPreview() {
    const quantity = parseFloat(document.getElementById('sellQuantity').value) || 0;
    const sellPrice = parseFloat(document.getElementById('sellPrice').value) || 0;
    const avgPrice = parseFloat(document.getElementById('sellAvgPrice').value) || 0;
    const fees = parseFloat(document.getElementById('sellFees').value) || 0;

    if (quantity > 0 && sellPrice > 0) {
      const revenue = quantity * sellPrice - fees;
      const cost = quantity * avgPrice;
      const profit = revenue - cost;
      const profitPercent = cost > 0 ? (profit / cost * 100) : 0;

      const profitDiv = document.getElementById('profitPreview');
      profitDiv.style.display = 'block';
      profitDiv.innerHTML = `
        <strong>${appState.t('positions.realizedProfit')}:</strong><br/>
        <span class="${profit >= 0 ? 'positive' : 'negative'}" style="font-size: 1.2rem;">
          ${appState.formatCurrency(profit)} (${profitPercent.toFixed(2)}%)
        </span>
      `;
    }
  },

  editTransaction(id, type, quantity, pricePerUnit, fees, date) {
    document.getElementById('editTransactionId').value = id;
    document.getElementById('editTxType').value = type;
    document.getElementById('editTxQuantity').value = quantity;
    document.getElementById('editTxPrice').value = pricePerUnit;
    document.getElementById('editTxFees').value = fees;
    document.getElementById('editTxDate').value = date.split('.')[0].slice(0, 16);
    document.getElementById('editTransactionModal').style.display = 'block';
  },

  async deleteTransaction(id) {
    if (await appState.showConfirm(appState.t('confirm.deleteTransaction'), appState.t('confirm.deleteTransactionMsg'))) {
      try {
        const scrollPos = window.scrollY;
        await api.delete(`/transactions/${id}`);
        await api.post('/sync', {});
        await this.render();
        window.scrollTo(0, scrollPos);
      } catch (error) {
        alert('Erreur: ' + error.message);
      }
    }
  },

  async deletePosition(id, name) {
    if (await appState.showConfirm(appState.t('confirm.deletePosition'), `${appState.t('confirm.deletePositionMsg')} ${name} ?`)) {
      try {
        await api.delete(`/holdings/${id}`);
        this.render();
      } catch (error) {
        alert('Erreur: ' + error.message);
      }
    }
  },

  // Lazily renders transaction table on first expand, toggles visibility after.
  toggleTransactions(key) {
    const container = document.getElementById(`transactions-${key}`);
    if (!container) return;

    const isOpen = container.style.display !== 'none';
    if (isOpen) {
      container.style.display = 'none';
      return;
    }

    // Build transaction table on first open
    if (!container.dataset.loaded) {
      const item = this._assetsWithTransactions && this._assetsWithTransactions.get(key);
      if (item) {
        const h = item.holding;
        let avgPrice = 0;
        if (h) {
          avgPrice = parseFloat(h.avgPrice);
        } else {
          let totalCost = 0, totalQty = 0;
          item.transactions.forEach(t => {
            if (t.type === 'buy') {
              totalCost += parseFloat(t.quantity) * parseFloat(t.pricePerUnit);
              totalQty += parseFloat(t.quantity);
            }
          });
          avgPrice = totalQty > 0 ? totalCost / totalQty : 0;
        }

        const assetTransactions = [...item.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = `
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 1rem 0; color: var(--text-secondary);">${appState.t('positions.transactions')} (${assetTransactions.length})</h4>
            <table style="width: 100%;">
              <thead>
                <tr>
                  <th>${appState.t('positions.date')}</th>
                  <th>${appState.t('positions.type')}</th>
                  <th>${appState.t('dashboard.quantity')}</th>
                  <th>${appState.t('dashboard.avgPrice')}</th>
                  <th>${appState.t('positions.fees')}</th>
                  <th>${appState.t('positions.total')}</th>
                  <th>P/L</th>
                  <th>${appState.t('positions.actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${assetTransactions.map(t => {
                  const txTotal = parseFloat(t.quantity) * parseFloat(t.pricePerUnit);
                  let realizedPL = 0;
                  if (t.type === 'sell') {
                    realizedPL = (parseFloat(t.pricePerUnit) - avgPrice) * parseFloat(t.quantity) - parseFloat(t.fees);
                  }
                  return `
                    <tr>
                      <td>${new Date(t.date).toLocaleString(appState.language === 'fr' ? 'fr-FR' : 'en-US')}</td>
                      <td><span style="color: ${t.type === 'buy' ? 'var(--success)' : 'var(--danger)'}">${t.type === 'buy' ? appState.t('positions.buy') : appState.t('positions.sell')}</span></td>
                      <td>${parseFloat(t.quantity)}</td>
                      <td>${appState.formatCurrency(parseFloat(t.pricePerUnit))}</td>
                      <td>${appState.formatCurrency(parseFloat(t.fees))}</td>
                      <td>${appState.formatCurrency(txTotal + parseFloat(t.fees))}</td>
                      <td>${t.type === 'sell' ? `<span class="${realizedPL >= 0 ? 'positive' : 'negative'}">${appState.formatCurrency(realizedPL)}</span>` : '-'}</td>
                      <td>
                        <button onclick='positionsController.editTransaction("${t.id}", "${t.type}", ${t.quantity}, ${t.pricePerUnit}, ${t.fees}, "${t.date}")' style="padding: 0.4rem 0.6rem; font-size: 0.85rem; background: transparent; border: 1px solid var(--border);" title="${appState.t('positions.edit')}">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button onclick='positionsController.deleteTransaction("${t.id}")' style="padding: 0.4rem 0.6rem; font-size: 0.85rem; background: transparent; border: 1px solid var(--danger); color: var(--danger);" title="${appState.t('positions.delete')}">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
        container.dataset.loaded = 'true';
      }
    }

    container.style.display = 'block';
  }
};
