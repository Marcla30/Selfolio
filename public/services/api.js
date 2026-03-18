const API_BASE = '/api';

// CSRF token cache
let csrfToken = null;

// Fetch CSRF token from server
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf-token`);
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch (e) {
    console.error('Failed to fetch CSRF token:', e);
    return null;
  }
}

// Clear CSRF token cache (call after login/logout)
function clearCsrfToken() {
  csrfToken = null;
}

const api = {
  async get(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`);
    return res.json();
  },

  async post(endpoint, data) {
    const token = await getCsrfToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-csrf-token'] = token;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async put(endpoint, data) {
    const token = await getCsrfToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-csrf-token'] = token;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async delete(endpoint) {
    const token = await getCsrfToken();
    const headers = {};
    if (token) headers['x-csrf-token'] = token;

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers
    });
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
    getPrice: (id, currency) => api.get(`/assets/${id}/price?currency=${currency}`),
    getHistoricalPrice: (id, date, currency) => api.get(`/assets/${id}/historical-price?date=${encodeURIComponent(date)}&currency=${currency}`)
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
    getChange24h: (currency, portfolioId) => api.get(`/stats/change24h?currency=${currency || 'EUR'}&portfolioId=${portfolioId || ''}`)
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
    import: (data) => api.post('/cs2/import', data),
    profiles: () => api.get('/cs2/profiles')
  },

  // Clear CSRF token cache (call after login/logout to refresh token)
  clearCsrfToken
};
