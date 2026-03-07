require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { initializeVapidKeys } = require('./services/pushService');
const { startWalletSyncJob } = require('./jobs/walletSync');
const { startDailyPriceJob } = require('./jobs/priceSnapshot');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'portfolio-tracker-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// Auth routes (no auth required)
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/api/portfolios', requireAuth, require('./routes/portfolios'));
app.use('/api/assets', requireAuth, require('./routes/assets'));
app.use('/api/holdings', requireAuth, require('./routes/holdings'));
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/wallets', requireAuth, require('./routes/wallets'));
app.use('/api/stats', requireAuth, require('./routes/stats'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/notifications', requireAuth, require('./routes/notifications'));
app.use('/api/history', requireAuth, require('./routes/history'));
app.use('/api', requireAuth, require('./routes/sync'));
app.use('/api', requireAuth, require('./routes/import'));
app.use('/api', requireAuth, require('./routes/cache'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

async function start() {
  try {
    await initializeVapidKeys();
    startWalletSyncJob();
    startDailyPriceJob();
    
    app.listen(PORT, () => {
      console.log(`Portfolio Tracker running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
