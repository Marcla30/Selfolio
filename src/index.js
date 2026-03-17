require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const path = require('path');
const { initializeVapidKeys } = require('./services/pushService');
const { startWalletSyncJob } = require('./jobs/walletSync');
const { startDailyPriceJob } = require('./jobs/priceSnapshot');
const { requireAuth } = require('./middleware/auth');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

// Validate required environment variables
const requiredEnvVars = ['SESSION_SECRET', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (nginx etc.) so req.secure reflects X-Forwarded-Proto: https
app.set('trust proxy', 1);

// CORS origin should always be explicitly configured
const corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin) {
  console.error('CORS_ORIGIN environment variable is required');
  process.exit(1);
}

app.use(cors({ credentials: true, origin: corsOrigin }));
app.use(express.json());
app.use(session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'Session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 hours (rolling — extends on each request)
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// Auth routes with rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Protected routes with rate limiting
app.use('/api/portfolios', requireAuth, apiLimiter, require('./routes/portfolios'));
app.use('/api/assets', requireAuth, apiLimiter, require('./routes/assets'));
app.use('/api/holdings', requireAuth, apiLimiter, require('./routes/holdings'));
app.use('/api/transactions', requireAuth, apiLimiter, require('./routes/transactions'));
app.use('/api/wallets', requireAuth, apiLimiter, require('./routes/wallets'));
app.use('/api/stats', requireAuth, apiLimiter, require('./routes/stats'));
app.use('/api/settings', requireAuth, apiLimiter, require('./routes/settings'));
app.use('/api/notifications', requireAuth, apiLimiter, require('./routes/notifications'));
app.use('/api/history', requireAuth, apiLimiter, require('./routes/history'));
app.use('/api', requireAuth, apiLimiter, require('./routes/sync'));
app.use('/api', requireAuth, apiLimiter, require('./routes/import'));
app.use('/api', requireAuth, apiLimiter, require('./routes/cache'));
app.use('/api/cs2', requireAuth, apiLimiter, require('./routes/cs2'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: isDevelopment ? err.message : 'Internal server error'
  });
});

async function start() {
  try {
    await initializeVapidKeys();
    startWalletSyncJob();
    startDailyPriceJob();
    
    app.listen(PORT, () => {
      console.log(`Selfolio running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
