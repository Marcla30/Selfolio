const API_BASE = '/api';

const api = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`);
    return res.json();
  },

  async post(endpoint, data) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async put(endpoint, data) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async delete(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
    return res.json();
  },

  portfolios: {
    getAll: () => api.get('/portfolios'),
    create: (data) => api.post('/portfolios', data),
    delete: (id) => api.delete(`/portfolios/${id}`)
  },

  assets: {
    getAll: () => api.get('/assets'),
    getById: (id) => api.get(`/assets/${id}`),
    create: (data) => api.post('/assets', data),
    getPrice: (id, currency) => api.get(`/assets/${id}/price?currency=${currency}`)
  },

  holdings: {
    getAll: (portfolioId, currency) => api.get(`/holdings?portfolioId=${portfolioId || ''}&currency=${currency || 'EUR'}`),
  },

  transactions: {
    getAll: (portfolioId, assetId) => api.get(`/transactions?portfolioId=${portfolioId || ''}&assetId=${assetId || ''}`),
    create: (data) => api.post('/transactions', data)
  },

  wallets: {
    getAll: () => api.get('/wallets'),
    create: (data) => api.post('/wallets', data),
    sync: () => api.post('/wallets/sync'),
    delete: (id) => api.delete(`/wallets/${id}`)
  },

  stats: {
    get: (portfolioId, currency) => api.get(`/stats?portfolioId=${portfolioId || ''}&currency=${currency || 'EUR'}`),
    getRecommendations: (portfolioId) => api.get(`/stats/recommendations?portfolioId=${portfolioId || ''}`),
    getRealizedGains: (portfolioId) => api.get(`/stats/realized-gains?portfolioId=${portfolioId || ''}`),
    getChange24h: (currency) => api.get(`/stats/change24h?currency=${currency || 'EUR'}`)
  },

  history: {
    get: (portfolioId, timeframe, currency) => api.get(`/history?portfolioId=${portfolioId || ''}&timeframe=${timeframe || '30d'}&currency=${currency || 'EUR'}`)
  },

  settings: {
    get: () => api.get('/settings'),
    update: (data) => api.put('/settings', data)
  },

  notifications: {
    getVapidKey: () => api.get('/notifications/vapid-public-key'),
    subscribe: (subscription) => api.post('/notifications/subscribe', subscription)
  },

  cs2: {
    preview: (url) => api.get(`/cs2/preview?url=${encodeURIComponent(url)}`),
    import: (data) => api.post('/cs2/import', data)
  }
};
