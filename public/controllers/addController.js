const addController = {
  async render() {
    const app = document.getElementById('app');
    const portfolios = await api.portfolios.getAll();

    app.innerHTML = `
      <div class="card">
        <h2>${appState.t('add.title')}</h2>
        
        <div class="tab-selector" id="tabSelector">
          <span id="currentTab">${appState.t('add.manual')}</span>
          <span>▼</span>
        </div>
        <div class="tab-dropdown" id="tabDropdown">
          <button id="manualDropdownBtn" class="active">${appState.t('add.manual')}</button>
          <button id="importDropdownBtn">${appState.t('add.import')}</button>
        </div>

        <div style="margin-bottom: 2rem;">
          <button id="manualBtn" class="tab-btn active">${appState.t('add.manual')}</button>
          <button id="importBtn" class="tab-btn">${appState.t('add.import')}</button>
        </div>

        <div id="manualForm">
          <form id="addAssetForm">
            <div class="form-group">
              <label>${appState.t('add.type')}</label>
              <select name="type" id="typeFilter" required>
                <option value="">${appState.t('add.selectType')}</option>
                <option value="crypto">${appState.t('add.typeCrypto')}</option>
                <option value="stock">${appState.t('add.typeStock')}</option>
                <option value="etf">${appState.t('add.typeEtf')}</option>
                <option value="metal">${appState.t('add.typeMetal')}</option>
                <option value="cash">${appState.t('add.typeCash')}</option>
                <option value="other">${appState.t('add.typeOther')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${appState.t('add.search')}</label>
              <input type="text" id="assetSearch" placeholder="${appState.t('add.searchPlaceholder')}" autocomplete="off">
              <div id="searchResults" class="search-results"></div>
            </div>
            <div class="form-group">
              <label>${appState.t('add.portfolio')}</label>
              <select name="portfolioId" required>
                ${portfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>${appState.t('add.quantity')}</label>
              <input type="number" step="0.00000001" name="quantity" required>
            </div>
            <div class="form-group">
              <label>${appState.t('add.date')}</label>
              <input type="datetime-local" name="date" id="addAssetDate" required>
            </div>
            <div class="form-group">
              <label>${appState.t('add.price')}</label>
              <input type="number" step="0.01" name="pricePerUnit" placeholder="${appState.t('add.pricePlaceholder')}">
            </div>
            <div class="form-group">
              <label>${appState.t('add.fees')}</label>
              <input type="number" step="0.01" name="fees" placeholder="${appState.t('add.feesPlaceholder')}">
            </div>
            <input type="hidden" name="symbol" required>
            <input type="hidden" name="name" required>
            <button type="submit">${appState.t('add.submit')}</button>
          </form>
        </div>

        <div id="walletForm" style="display: none;"></div>

        <div id="importForm" style="display: none;">
          <div style="padding-bottom: 2rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border);">
            <h3 style="margin-bottom: 0.5rem;">${appState.t('add.csvImportTitle')}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.25rem; font-size: 0.9rem;">${appState.t('add.csvImportDesc')}</p>
            <form id="importCsvForm">
              <div class="form-group">
                <label>${appState.t('add.csvFile')}</label>
                <input type="file" id="csvFileInput" accept=".csv" required>
              </div>
              <button type="submit">${appState.t('add.csvImportButton')}</button>
            </form>
            <div id="csvImportStatus" style="margin-top: 1rem; font-size: 0.9rem;"></div>
          </div>

          <form id="importExcelForm">
            <div class="form-group">
              <label>${appState.t('add.excelFile')}</label>
              <input type="file" name="file" accept=".xlsx,.xls" required>
            </div>
            <div class="form-group">
              <label>${appState.t('add.portfolio')}</label>
              <select name="portfolioId" required>
                ${portfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
              </select>
            </div>
            <button type="submit">${appState.t('add.importButton')}</button>
          </form>
          <div id="importStatus" style="margin-top: 1rem; color: var(--text-secondary);"></div>

          <div style="padding-top: 2rem; margin-top: 2rem; border-top: 1px solid var(--border);">
            <h3 style="margin-bottom: 0.5rem;">${appState.t('add.wallet')}</h3>
            <form id="addWalletForm">
              <div class="form-group">
                <label>${appState.t('add.walletAddress')}</label>
                <input type="text" name="address" placeholder="${appState.t('add.walletAddressPlaceholder')}" required>
              </div>
              <div class="form-group">
                <label>${appState.t('add.blockchain')}</label>
                <select name="blockchain" required>
                  <option value="bitcoin">Bitcoin (BTC)</option>
                  <option value="ethereum">Ethereum (ETH)</option>
                  <option value="bsc">Binance Smart Chain (BNB)</option>
                  <option value="tron">Tron (TRX)</option>
                  <option value="cosmos">Cosmos (ATOM)</option>
                </select>
              </div>
              <div class="form-group">
                <label>${appState.t('add.portfolio')}</label>
                <select name="portfolioId" required>
                  ${portfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
              </div>
              <button type="submit">${appState.t('add.importTransactions')}</button>
            </form>
            <div id="walletStatus" style="margin-top: 1rem; color: var(--text-secondary);"></div>
          </div>

          <div style="padding-top: 2rem; margin-top: 2rem; border-top: 1px solid var(--border);">
            <h3 style="margin-bottom: 0.5rem;">${appState.t('add.steam.title')}</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1.25rem; font-size: 0.9rem;">${appState.t('add.steam.desc')}</p>
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
              <input type="text" id="steamUrlInput" placeholder="${appState.t('add.steam.urlPlaceholder')}" style="flex: 1;">
              <button id="steamPreviewBtn" type="button">${appState.t('add.steam.preview')}</button>
            </div>
            <div id="steamPreviewResult" style="display: none;">
              <p id="steamPreviewCount" style="color: var(--text-secondary); margin-bottom: 0.75rem; font-size: 0.9rem;"></p>
              <div id="steamSkinsList" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem; margin-bottom: 1rem;"></div>
              <div class="form-group">
                <label>${appState.t('add.portfolio')}</label>
                <select id="steamPortfolioSelect">
                  ${portfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
              </div>
              <button id="steamImportBtn" type="button">${appState.t('add.steam.importBtn')}</button>
            </div>
            <div id="steamStatus" style="margin-top: 1rem; color: var(--text-secondary);"></div>
          </div>

          <div style="margin-top: 2rem;">
            <h3>${appState.t('add.importHistoryTitle')}</h3>
            <div id="importHistory"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>${appState.t('add.watchedWallets')}</h3>
        <div id="walletsList"></div>
      </div>
    `;

    this.setupEventListeners();
    this.loadWallets();
    
    // Set default date/time to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('addAssetDate').value = now.toISOString().slice(0, 16);
  },

  setupEventListeners() {
    // Desktop buttons
    document.getElementById('manualBtn').addEventListener('click', () => {
      this.switchTab('manual');
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      this.switchTab('import');
      this.loadImportHistory();
    });

    // Mobile dropdown
    const tabSelector = document.getElementById('tabSelector');
    const tabDropdown = document.getElementById('tabDropdown');
    const currentTab = document.getElementById('currentTab');
    
    if (tabSelector && tabDropdown) {
      tabSelector.addEventListener('click', () => {
        tabDropdown.classList.toggle('active');
      });
      
      document.getElementById('manualDropdownBtn').addEventListener('click', () => {
        this.switchTab('manual');
        currentTab.textContent = appState.t('add.manual');
        tabDropdown.classList.remove('active');
      });
      
      document.getElementById('importDropdownBtn').addEventListener('click', () => {
        this.switchTab('import');
        currentTab.textContent = appState.t('add.import');
        tabDropdown.classList.remove('active');
        this.loadImportHistory();
      });

      document.addEventListener('click', (e) => {
        if (!tabSelector.contains(e.target) && !tabDropdown.contains(e.target)) {
          tabDropdown.classList.remove('active');
        }
      });
    }

    const searchInput = document.getElementById('assetSearch');
    const typeFilter = document.getElementById('typeFilter');
    let searchTimeout;
    
    typeFilter.addEventListener('change', () => {
      document.getElementById('searchResults').innerHTML = '';
      document.getElementById('assetSearch').value = '';
    });
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length < 2) {
        document.getElementById('searchResults').innerHTML = '';
        return;
      }
      searchTimeout = setTimeout(() => this.searchAssets(query), 300);
    });

    document.getElementById('addAssetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);

      if (!data.symbol || !data.name) {
        alert(appState.t('add.selectAsset'));
        return;
      }

      const savedPortfolioId = data.portfolioId;
      const savedType = data.type;

      try {
        const assets = await api.assets.getAll();
        let asset = assets.find(a => a.symbol === data.symbol);

        if (!asset) {
          asset = await api.assets.create({
            symbol: data.symbol,
            name: data.name,
            type: data.type
          });
        }

        await api.transactions.create({
          portfolioId: data.portfolioId,
          assetId: asset.id,
          type: 'buy',
          quantity: data.quantity,
          date: data.date,
          pricePerUnit: data.pricePerUnit || undefined,
          fees: data.fees || 0
        });

        // Reset form but keep portfolio and type selections
        e.target.reset();
        document.querySelector('[name="portfolioId"]').value = savedPortfolioId;
        document.querySelector('[name="type"]').value = savedType;
        document.getElementById('assetSearch').value = '';
        document.getElementById('searchResults').innerHTML = '';
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('addAssetDate').value = now.toISOString().slice(0, 16);

        appState.showToast(appState.t('add.successToast'));
      } catch (error) {
        alert('Erreur: ' + error.message);
      }
    });

    document.getElementById('addWalletForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      const status = document.getElementById('walletStatus');

      status.innerHTML = 'Récupération...';

      try {
        await api.wallets.create(data);
        status.innerHTML = 'Wallet ajouté !';
        await api.wallets.sync();
        this.loadWallets();
        e.target.reset();
      } catch (error) {
        status.innerHTML = 'Erreur: ' + error.message;
      }
    });

    document.getElementById('importCsvForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.importCSV();
    });

    document.getElementById('steamPreviewBtn').addEventListener('click', () => this.steamPreview());
    document.getElementById('steamImportBtn').addEventListener('click', () => this.steamImport());

    document.getElementById('importExcelForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const status = document.getElementById('importStatus');

      status.innerHTML = '<div style="background: var(--bg-tertiary); border-radius: 4px; height: 20px; overflow: hidden;"><div id="progressBar" style="background: var(--success); height: 100%; width: 0%; transition: width 0.3s;"></div></div><div id="progressText" style="margin-top: 0.5rem;">Import en cours...</div>';

      try {
        const xhr = new XMLHttpRequest();
        
        xhr.addEventListener('readystatechange', () => {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            const lines = xhr.responseText.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  if (data.progress) {
                    document.getElementById('progressBar').style.width = data.progress + '%';
                    document.getElementById('progressText').textContent = `Traitement: ${data.current}/${data.total} actifs (${data.progress}%)`;
                  }
                  
                  if (data.done) {
                    const result = data.results;
                    let msg = `Import terminé: ${result.success} actifs importés`;
                    if (result.ignored && result.ignored.length > 0) {
                      msg += `<br/><br/><strong>Lignes ignorées (${result.ignored.length}):</strong><br/>${result.ignored.join('<br/>')}`;
                    }
                    if (result.errors.length > 0) {
                      msg += `<br/><br/><strong>Erreurs (${result.errors.length}):</strong><br/>${result.errors.join('<br/>')}`;
                    }
                    status.innerHTML = msg;
                    if (result.success > 0) {
                      setTimeout(() => navigate('/'), 3000);
                    }
                    this.loadImportHistory();
                  }
                  
                  if (data.error) {
                    status.innerHTML = 'Erreur: ' + data.error;
                  }
                } catch (e) {}
              }
            }
          }
        });

        xhr.addEventListener('error', () => {
          status.innerHTML = 'Erreur de connexion';
        });

        xhr.open('POST', '/api/import-excel');
        xhr.send(formData);
      } catch (error) {
        status.innerHTML = 'Erreur: ' + error.message;
      }
    });
  },

  async searchAssets(query) {
    const resultsDiv = document.getElementById('searchResults');
    const typeFilter = document.getElementById('typeFilter').value;
    
    if (!typeFilter) {
      resultsDiv.innerHTML = `<div style="padding: 0.5rem; color: var(--text-secondary);">${appState.t('add.selectFirst')}</div>`;
      return;
    }
    
    resultsDiv.innerHTML = `<div style="padding: 0.5rem;">${appState.t('add.searching')}</div>`;

    try {
      const results = [];
      const lowerQuery = query.toLowerCase();

      if (typeFilter === 'stock') {
        const stocks = [
          // CAC 40
          { symbol: 'MC.PA', name: 'LVMH', type: 'stock', typeLabel: 'Action' },
          { symbol: 'TTE.PA', name: 'TotalEnergies', type: 'stock', typeLabel: 'Action' },
          { symbol: 'OR.PA', name: 'L\'Oréal', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SAN.PA', name: 'Sanofi', type: 'stock', typeLabel: 'Action' },
          { symbol: 'AI.PA', name: 'Air Liquide', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CS.PA', name: 'AXA', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SU.PA', name: 'Schneider Electric', type: 'stock', typeLabel: 'Action' },
          { symbol: 'BNP.PA', name: 'BNP Paribas', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SAF.PA', name: 'Safran', type: 'stock', typeLabel: 'Action' },
          { symbol: 'AIR.PA', name: 'Airbus', type: 'stock', typeLabel: 'Action' },
          { symbol: 'DG.PA', name: 'Vinci', type: 'stock', typeLabel: 'Action' },
          { symbol: 'LI.PA', name: 'Klépierre', type: 'stock', typeLabel: 'Action' },
          { symbol: 'BN.PA', name: 'Danone', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CAP.PA', name: 'Capgemini', type: 'stock', typeLabel: 'Action' },
          { symbol: 'RMS.PA', name: 'Hermès', type: 'stock', typeLabel: 'Action' },
          { symbol: 'KER.PA', name: 'Kering', type: 'stock', typeLabel: 'Action' },
          { symbol: 'EN.PA', name: 'Bouygues', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SGO.PA', name: 'Saint-Gobain', type: 'stock', typeLabel: 'Action' },
          { symbol: 'EL.PA', name: 'EssilorLuxottica', type: 'stock', typeLabel: 'Action' },
          { symbol: 'STMPA.PA', name: 'STMicroelectronics', type: 'stock', typeLabel: 'Action' },
          { symbol: 'PUB.PA', name: 'Publicis', type: 'stock', typeLabel: 'Action' },
          { symbol: 'RI.PA', name: 'Pernod Ricard', type: 'stock', typeLabel: 'Action' },
          { symbol: 'URW.AS', name: 'Unibail-Rodamco-Westfield', type: 'stock', typeLabel: 'Action' },
          { symbol: 'GLE.PA', name: 'Société Générale', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ACA.PA', name: 'Crédit Agricole', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ML.PA', name: 'Michelin', type: 'stock', typeLabel: 'Action' },
          { symbol: 'RNO.PA', name: 'Renault', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ORA.PA', name: 'Orange', type: 'stock', typeLabel: 'Action' },
          { symbol: 'VIE.PA', name: 'Veolia', type: 'stock', typeLabel: 'Action' },
          { symbol: 'DSY.PA', name: 'Dassault Systèmes', type: 'stock', typeLabel: 'Action' },
          { symbol: 'TEP.PA', name: 'Téléperformance', type: 'stock', typeLabel: 'Action' },
          { symbol: 'WLN.PA', name: 'Worldline', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ATO.PA', name: 'Atos', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ALO.PA', name: 'Alstom', type: 'stock', typeLabel: 'Action' },
          { symbol: 'FP.PA', name: 'TotalEnergies', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ENGI.PA', name: 'Engie', type: 'stock', typeLabel: 'Action' },
          { symbol: 'FGR.PA', name: 'Eiffage', type: 'stock', typeLabel: 'Action' },
          { symbol: 'HO.PA', name: 'Thales', type: 'stock', typeLabel: 'Action' },
          { symbol: 'VIV.PA', name: 'Vivendi', type: 'stock', typeLabel: 'Action' },
          { symbol: 'MMB.PA', name: 'Lagardère', type: 'stock', typeLabel: 'Action' },
          { symbol: 'DEC.PA', name: 'JCDecaux', type: 'stock', typeLabel: 'Action' },
          { symbol: 'FDJ.PA', name: 'La Française des Jeux', type: 'stock', typeLabel: 'Action' },
          { symbol: 'NXI.PA', name: 'Nexity', type: 'stock', typeLabel: 'Action' },
          { symbol: 'OVH.PA', name: 'OVHcloud', type: 'stock', typeLabel: 'Action' },
          { symbol: 'RUI.PA', name: 'Rubis', type: 'stock', typeLabel: 'Action' },
          { symbol: 'STF.PA', name: 'Stef', type: 'stock', typeLabel: 'Action' },
          { symbol: 'UBI.PA', name: 'Ubisoft', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ETL.PA', name: 'Eutelsat', type: 'stock', typeLabel: 'Action' },
          { symbol: 'GTT.PA', name: 'GTT', type: 'stock', typeLabel: 'Action' },
          { symbol: 'EDEN.PA', name: 'Edenred', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SW.PA', name: 'Sodexo', type: 'stock', typeLabel: 'Action' },
          { symbol: 'LR.PA', name: 'Legrand', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SOLB.BR', name: 'Solvay', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ABI.BR', name: 'AB InBev', type: 'stock', typeLabel: 'Action' },
          // S&P 500 principales
          { symbol: 'AAPL', name: 'Apple', type: 'stock', typeLabel: 'Action' },
          { symbol: 'MSFT', name: 'Microsoft', type: 'stock', typeLabel: 'Action' },
          { symbol: 'GOOGL', name: 'Alphabet (Google)', type: 'stock', typeLabel: 'Action' },
          { symbol: 'AMZN', name: 'Amazon', type: 'stock', typeLabel: 'Action' },
          { symbol: 'TSLA', name: 'Tesla', type: 'stock', typeLabel: 'Action' },
          { symbol: 'NVDA', name: 'Nvidia', type: 'stock', typeLabel: 'Action' },
          { symbol: 'META', name: 'Meta (Facebook)', type: 'stock', typeLabel: 'Action' },
          { symbol: 'NFLX', name: 'Netflix', type: 'stock', typeLabel: 'Action' },
          { symbol: 'UPS', name: 'United Parcel Service', type: 'stock', typeLabel: 'Action' },
          { symbol: 'JPM', name: 'JPMorgan Chase', type: 'stock', typeLabel: 'Action' },
          { symbol: 'V', name: 'Visa', type: 'stock', typeLabel: 'Action' },
          { symbol: 'MA', name: 'Mastercard', type: 'stock', typeLabel: 'Action' },
          { symbol: 'WMT', name: 'Walmart', type: 'stock', typeLabel: 'Action' },
          { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'stock', typeLabel: 'Action' },
          { symbol: 'PG', name: 'Procter & Gamble', type: 'stock', typeLabel: 'Action' },
          { symbol: 'DIS', name: 'Disney', type: 'stock', typeLabel: 'Action' },
          { symbol: 'BAC', name: 'Bank of America', type: 'stock', typeLabel: 'Action' },
          { symbol: 'XOM', name: 'Exxon Mobil', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CVX', name: 'Chevron', type: 'stock', typeLabel: 'Action' },
          { symbol: 'KO', name: 'Coca-Cola', type: 'stock', typeLabel: 'Action' },
          { symbol: 'PEP', name: 'PepsiCo', type: 'stock', typeLabel: 'Action' },
          { symbol: 'COST', name: 'Costco', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ABBV', name: 'AbbVie', type: 'stock', typeLabel: 'Action' },
          { symbol: 'MRK', name: 'Merck', type: 'stock', typeLabel: 'Action' },
          { symbol: 'PFE', name: 'Pfizer', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CSCO', name: 'Cisco', type: 'stock', typeLabel: 'Action' },
          { symbol: 'INTC', name: 'Intel', type: 'stock', typeLabel: 'Action' },
          { symbol: 'AMD', name: 'AMD', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ADBE', name: 'Adobe', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CRM', name: 'Salesforce', type: 'stock', typeLabel: 'Action' },
          { symbol: 'ORCL', name: 'Oracle', type: 'stock', typeLabel: 'Action' },
          { symbol: 'IBM', name: 'IBM', type: 'stock', typeLabel: 'Action' },
          { symbol: 'QCOM', name: 'Qualcomm', type: 'stock', typeLabel: 'Action' },
          { symbol: 'TXN', name: 'Texas Instruments', type: 'stock', typeLabel: 'Action' },
          { symbol: 'NKE', name: 'Nike', type: 'stock', typeLabel: 'Action' },
          { symbol: 'MCD', name: 'McDonald\'s', type: 'stock', typeLabel: 'Action' },
          { symbol: 'SBUX', name: 'Starbucks', type: 'stock', typeLabel: 'Action' },
          { symbol: 'BA', name: 'Boeing', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CAT', name: 'Caterpillar', type: 'stock', typeLabel: 'Action' },
          { symbol: 'GE', name: 'General Electric', type: 'stock', typeLabel: 'Action' },
          { symbol: 'MMM', name: '3M', type: 'stock', typeLabel: 'Action' },
          { symbol: 'HON', name: 'Honeywell', type: 'stock', typeLabel: 'Action' },
          { symbol: 'UNH', name: 'UnitedHealth', type: 'stock', typeLabel: 'Action' },
          { symbol: 'HD', name: 'Home Depot', type: 'stock', typeLabel: 'Action' },
          { symbol: 'LOW', name: 'Lowe\'s', type: 'stock', typeLabel: 'Action' },
          { symbol: 'T', name: 'AT&T', type: 'stock', typeLabel: 'Action' },
          { symbol: 'VZ', name: 'Verizon', type: 'stock', typeLabel: 'Action' },
          { symbol: 'CMCSA', name: 'Comcast', type: 'stock', typeLabel: 'Action' }
        ];
        stocks.forEach(s => {
          if (s.name.toLowerCase().includes(lowerQuery) || s.symbol.toLowerCase().includes(lowerQuery)) {
            results.push(s);
          }
        });
      } else if (typeFilter === 'etf') {
        const etfs = [
          // ETF PEA
          { symbol: 'CW8.PA', name: 'Amundi MSCI World', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'EWLD.PA', name: 'Lyxor MSCI World', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PE500.PA', name: 'Amundi PEA S&P 500', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'LYPS.PA', name: 'Lyxor PEA S&P 500', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PAEEM.PA', name: 'Amundi PEA Emerging Markets', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PANX.PA', name: 'Amundi PEA Nasdaq-100', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PCEU.PA', name: 'Amundi PEA Europe', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PUST.PA', name: 'Amundi PEA US Tech', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'RS2K.PA', name: 'Amundi Russell 2000', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'MEUD.PA', name: 'Amundi MSCI Europe', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'AASI.PA', name: 'Amundi MSCI Asia Pacific', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PAASI.PA', name: 'Amundi PEA Asie Pacifique', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'PJPN.PA', name: 'Amundi PEA Japan', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'IQQH.DE', name: 'iShares STOXX Europe 600 Real Estate', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'INRG.L', name: 'iShares Global Clean Energy', type: 'etf', typeLabel: 'ETF' },
          // ETF US
          { symbol: 'SPY', name: 'SPDR S&P 500', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'VOO', name: 'Vanguard S&P 500', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'IVV', name: 'iShares Core S&P 500', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq 100)', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'VTI', name: 'Vanguard Total Stock Market', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'AGG', name: 'iShares Core US Aggregate Bond', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'BND', name: 'Vanguard Total Bond Market', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'VNQ', name: 'Vanguard Real Estate', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'GLD', name: 'SPDR Gold Shares', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'SLV', name: 'iShares Silver Trust', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'EEM', name: 'iShares MSCI Emerging Markets', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'EFA', name: 'iShares MSCI EAFE', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'IWM', name: 'iShares Russell 2000', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLF', name: 'Financial Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLE', name: 'Energy Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLK', name: 'Technology Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLV', name: 'Health Care Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLI', name: 'Industrial Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'XLU', name: 'Utilities Select Sector SPDR', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'ARKK', name: 'ARK Innovation ETF', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'ARKG', name: 'ARK Genomic Revolution ETF', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'ICLN', name: 'iShares Global Clean Energy', type: 'etf', typeLabel: 'ETF' },
          { symbol: 'TAN', name: 'Invesco Solar ETF', type: 'etf', typeLabel: 'ETF' }
        ];
        etfs.forEach(e => {
          if (e.name.toLowerCase().includes(lowerQuery) || e.symbol.toLowerCase().includes(lowerQuery)) {
            results.push(e);
          }
        });
      } else if (typeFilter === 'metal') {
        const metals = [
          { symbol: 'XAU', name: 'Or (once)', type: 'metal', typeLabel: 'Métal', aliases: ['gold', 'or'] },
          { symbol: 'XAG', name: 'Argent (once)', type: 'metal', typeLabel: 'Métal', aliases: ['silver', 'argent'] }
        ];
        metals.forEach(m => {
          const matchName = m.name.toLowerCase().includes(lowerQuery);
          const matchSymbol = m.symbol.toLowerCase().includes(lowerQuery);
          const matchAlias = m.aliases.some(alias => alias.includes(lowerQuery));
          if (matchName || matchSymbol || matchAlias) {
            results.push(m);
          }
        });
      } else if (typeFilter === 'cash') {
        const currencies = [
          { symbol: 'EUR', name: 'Euro', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'USD', name: 'Dollar américain', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'GBP', name: 'Livre sterling', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'CHF', name: 'Franc suisse', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'JPY', name: 'Yen japonais', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'CAD', name: 'Dollar canadien', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'AUD', name: 'Dollar australien', type: 'cash', typeLabel: 'Devise' },
          { symbol: 'CNY', name: 'Yuan chinois', type: 'cash', typeLabel: 'Devise' }
        ];
        currencies.forEach(c => {
          if (c.name.toLowerCase().includes(lowerQuery) || c.symbol.toLowerCase().includes(lowerQuery)) {
            results.push(c);
          }
        });
      } else if (typeFilter === 'crypto') {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
          const d = await r.json();
          d.coins.slice(0, 8).forEach(c => {
            results.push({ symbol: c.symbol.toUpperCase(), name: c.name, type: 'crypto', typeLabel: 'Crypto' });
          });
        } catch (e) {}
      }

      if (results.length === 0) {
        resultsDiv.innerHTML = `<div style="padding: 0.5rem;">${appState.t('add.noResults')}</div>`;
        return;
      }

      resultsDiv.innerHTML = results.slice(0, 8).map(r => `
        <div class="search-result-item" data-symbol="${r.symbol}" data-name="${r.name}" data-type="${r.type}">
          <div style="display: flex; justify-content: space-between;">
            <div><strong>${r.name}</strong> <span style="color: var(--text-secondary);">(${r.symbol})</span></div>
            <span style="background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${r.typeLabel}</span>
          </div>
        </div>
      `).join('');

      document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          document.querySelector('[name="symbol"]').value = item.dataset.symbol;
          document.querySelector('[name="name"]').value = item.dataset.name;
          document.getElementById('assetSearch').value = `${item.dataset.name} (${item.dataset.symbol})`;
          resultsDiv.innerHTML = '';
        });
      });
    } catch (error) {
      resultsDiv.innerHTML = `<div style="padding: 0.5rem;">${appState.t('add.error')}</div>`;
    }
  },

  async loadWallets() {
    const wallets = await api.wallets.getAll();
    const walletsDiv = document.getElementById('walletsList');

    if (wallets.length === 0) {
      walletsDiv.innerHTML = `<p>${appState.t('add.noWallets')}</p>`;
      return;
    }

    walletsDiv.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>${appState.t('add.address')}</th>
            <th>${appState.t('add.blockchain')}</th>
            <th>${appState.t('add.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${wallets.map(w => `
            <tr>
              <td>${w.address.slice(0, 10)}...${w.address.slice(-8)}</td>
              <td>${w.blockchain}</td>
              <td>
                <button onclick="addController.deleteWallet('${w.id}')">${appState.t('add.deleteButton')}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async deleteWallet(id) {
    if (await appState.showConfirm(appState.t('confirm.deleteWallet'), appState.t('confirm.deleteWalletMsg'))) {
      await api.wallets.delete(id);
      this.loadWallets();
    }
  },

  async loadImportHistory() {
    try {
      const res = await fetch('/api/import-history');
      const history = await res.json();
      const historyDiv = document.getElementById('importHistory');

      if (history.length === 0) {
        historyDiv.innerHTML = `<p style="color: var(--text-secondary);">${appState.t('add.noImports')}</p>`;
        return;
      }

      historyDiv.innerHTML = history.map(h => `
        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <strong>${h.fileName}</strong>
            <span style="color: var(--text-secondary);">${new Date(h.createdAt).toLocaleString(appState.language === 'fr' ? 'fr-FR' : 'en-US')}</span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem;">
            ${appState.t('add.historyTotal')}: ${h.totalRows} ${appState.t('add.historyLines')} | 
            <span style="color: var(--success);">✓ ${h.successCount} ${appState.t('add.historyImported')}</span> | 
            <span style="color: var(--warning);">⚠ ${h.ignoredCount} ${appState.t('add.historyIgnored')}</span> | 
            <span style="color: var(--danger);">✗ ${h.errorCount} ${appState.t('add.historyErrors')}</span>
          </div>
          ${h.ignoredCount > 0 ? `
            <details style="margin-top: 0.5rem;">
              <summary style="cursor: pointer; color: var(--warning);">${appState.t('add.historyShowIgnored')} (${h.ignoredCount})</summary>
              <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.85rem;">
                ${h.ignoredAssets.map(a => `<li>${a}</li>`).join('')}
              </ul>
            </details>
          ` : ''}
        </div>
      `).join('');
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    }
  },
  
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  },

  async importCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    const status = document.getElementById('csvImportStatus');

    if (!file) return;

    status.textContent = appState.t('add.csvImportReading');

    let text;
    try {
      text = await file.text();
    } catch (e) {
      status.textContent = appState.t('add.csvImportEmpty');
      return;
    }

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      status.textContent = appState.t('add.csvImportEmpty');
      return;
    }

    const portfolios = await api.portfolios.getAll();
    const portfolioMap = {};
    portfolios.forEach(p => {
      portfolioMap[p.name.toLowerCase()] = p.id;
    });

    // Collect unique portfolio names from CSV
    const uniqueNames = new Set();
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i]);
      if (cols.length >= 1 && cols[0]) uniqueNames.add(cols[0]);
    }

    const missing = [...uniqueNames].filter(name => !portfolioMap[name.toLowerCase()]);

    if (missing.length === 0) {
      await this._runImport(lines, portfolioMap, status, file.name);
      return;
    }

    const isFr = appState.language === 'fr';
    status.innerHTML = `
      <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1.25rem;">
        <p style="margin-bottom: 1rem; font-weight: 500;">
          ${isFr ? `${missing.length > 1 ? 'Ces portefeuilles n\'existent pas' : 'Ce portefeuille n\'existe pas'} dans votre compte :` : `${missing.length > 1 ? 'These portfolios do not exist' : 'This portfolio does not exist'} in your account:`}
        </p>
        ${missing.map((name, idx) => `
          <div style="display: flex; align-items: center; gap: 1rem; padding: 0.6rem 0; border-bottom: 1px solid var(--border);">
            <strong style="flex: 1;">"${name}"</strong>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
              <input type="radio" name="csv_pa_${idx}" value="create" checked style="width: auto; padding: 0;">
              ${isFr ? 'Créer' : 'Create'}
            </label>
            <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
              <input type="radio" name="csv_pa_${idx}" value="ignore" style="width: auto; padding: 0;">
              ${isFr ? 'Ignorer' : 'Ignore'}
            </label>
          </div>
        `).join('')}
        <button id="csvProceedBtn" style="margin-top: 1rem; width: 100%;">
          ${isFr ? 'Continuer l\'import' : 'Continue import'}
        </button>
      </div>
    `;

    document.getElementById('csvProceedBtn').addEventListener('click', async () => {
      // Create portfolios marked as "create"
      for (const [idx, name] of missing.entries()) {
        const radio = document.querySelector(`input[name="csv_pa_${idx}"]:checked`);
        if (radio && radio.value === 'create') {
          try {
            const created = await api.portfolios.create({ name });
            portfolioMap[name.toLowerCase()] = created.id;
          } catch (err) {
            // creation failed, rows will be skipped
          }
        }
      }
      await this._runImport(lines, portfolioMap, status, file.name);
    });
  },

  async _runImport(lines, portfolioMap, status, fileName) {
    status.textContent = appState.t('add.csvImportReading');

    let assets = await api.assets.getAll();
    let success = 0;
    let ignored = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i]);
      if (cols.length < 9) continue;

      const portfolioName = cols[0];
      const assetName = cols[1];
      const symbol = cols[2];
      const assetType = cols[3];
      const txType = cols[4];
      const date = cols[5];
      const quantity = parseFloat(cols[6]);
      const pricePerUnit = parseFloat(cols[7]);
      const fees = parseFloat(cols[8]) || 0;

      const portfolioId = portfolioMap[portfolioName.toLowerCase()];
      if (!portfolioId) {
        ignored++;
        continue;
      }

      if (!symbol || !assetName || isNaN(quantity) || isNaN(pricePerUnit)) {
        errors.push(`L.${i + 1}: ${appState.t('add.csvImportInvalidRow')}`);
        continue;
      }

      try {
        let asset = assets.find(a => a.symbol === symbol);
        if (!asset) {
          asset = await api.assets.create({ symbol, name: assetName, type: assetType });
          assets.push(asset);
        }

        await api.transactions.create({
          portfolioId,
          assetId: asset.id,
          type: txType === 'sell' ? 'sell' : 'buy',
          quantity,
          date: date.replace(' ', 'T'),
          pricePerUnit,
          fees
        });

        success++;
      } catch (err) {
        errors.push(`L.${i + 1}: ${err.message}`);
      }
    }

    const totalRows = lines.length - 1;

    // Save to import history
    try {
      await fetch('/api/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileName || 'import.csv',
          totalRows,
          successCount: success,
          ignoredCount: ignored,
          errorCount: errors.length,
          ignoredAssets: [],
          errors
        })
      });
    } catch (e) {}

    let html = `<span style="color: var(--success);">${appState.t('add.csvImportDone')}: ${success} ${appState.t('add.csvImportTransactions')}</span>`;
    if (errors.length > 0) {
      html += `<br><br><strong style="color: var(--danger);">${appState.t('add.csvImportErrors')} (${errors.length}):</strong><br><span style="color: var(--text-secondary);">${errors.join('<br>')}</span>`;
    }
    status.innerHTML = html;

    if (success > 0) {
      document.getElementById('csvFileInput').value = '';
    }

    this.loadImportHistory();
  },

  async steamPreview() {
    const url = document.getElementById('steamUrlInput').value.trim();
    const status = document.getElementById('steamStatus');
    const previewResult = document.getElementById('steamPreviewResult');

    if (!url) {
      status.textContent = appState.t('add.steam.errorNoUrl');
      return;
    }

    status.textContent = appState.t('add.steam.loading');
    previewResult.style.display = 'none';

    try {
      const data = await api.cs2.preview(url);

      if (data.error) {
        status.textContent = data.error;
        return;
      }

      // Store steamId on the button for later use
      document.getElementById('steamImportBtn').dataset.steamId = data.steamId;
      document.getElementById('steamImportBtn').dataset.steamUrl = url;

      document.getElementById('steamPreviewCount').textContent =
        appState.language === 'fr'
          ? `${data.count} skin(s) trouvé(s) dans l'inventaire CS2`
          : `${data.count} skin(s) found in CS2 inventory`;

      document.getElementById('steamSkinsList').innerHTML = data.skins.map(s => `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid var(--border);">
          ${s.iconUrl ? `<img src="${s.iconUrl}" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.style.display='none'">` : ''}
          <span style="flex: 1; font-size: 0.85rem;">${s.marketHashName}</span>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">×${s.count}</span>
        </div>
      `).join('');

      previewResult.style.display = 'block';
      status.textContent = '';
    } catch (error) {
      status.textContent = appState.t('add.steam.errorFetch') + ': ' + error.message;
    }
  },

  async steamImport() {
    const btn = document.getElementById('steamImportBtn');
    const status = document.getElementById('steamStatus');
    const steamId = btn.dataset.steamId;
    const steamUrl = btn.dataset.steamUrl;
    const portfolioId = document.getElementById('steamPortfolioSelect').value;

    if (!steamId || !portfolioId) return;

    status.textContent = appState.t('add.steam.importing');
    btn.disabled = true;

    try {
      const result = await api.cs2.import({ steamId, steamUrl, portfolioId });

      if (result.error) {
        status.style.color = 'var(--danger)';
        status.textContent = result.error;
        btn.disabled = false;
        return;
      }

      const lang = appState.language === 'fr';
      if (result.skipped > 0 && result.imported === 0) {
        status.style.color = 'var(--warning)';
        status.textContent = lang
          ? `${result.skipped} skin(s) déjà importé(s) — aucun doublon ajouté`
          : `${result.skipped} skin(s) already imported — no duplicates added`;
      } else {
        status.style.color = 'var(--success)';
        status.textContent = lang
          ? `${result.imported} skin(s) importé(s)${result.skipped > 0 ? `, ${result.skipped} ignoré(s) (déjà présents)` : ''}`
          : `${result.imported} skin(s) imported${result.skipped > 0 ? `, ${result.skipped} skipped (already present)` : ''}`;
        if (result.imported > 0) {
          setTimeout(() => navigate('/'), 2000);
        }
      }
    } catch (error) {
      status.style.color = 'var(--danger)';
      status.textContent = appState.t('add.steam.errorFetch') + ': ' + error.message;
    } finally {
      btn.disabled = false;
    }
  },

  switchTab(tab) {
    document.getElementById('manualForm').style.display = tab === 'manual' ? 'block' : 'none';
    document.getElementById('importForm').style.display = tab === 'import' ? 'block' : 'none';

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tab}Btn`).classList.add('active');

    document.querySelectorAll('.tab-dropdown button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tab}DropdownBtn`).classList.add('active');
  }
};
