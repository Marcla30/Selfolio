# Selfolio

Self-hosted investment tracking application inspired by Delta. No subscription, no third-party account required.

## Features

### Supported assets

| Type | Examples | Price source | Update frequency |
|---|---|---|---|
| Cryptocurrency | BTC, ETH, SOL… | CoinGecko | Every 30 min (batched) |
| Stock | AAPL, AI.PA, LVMH… | Yahoo Finance | Every 30 min |
| ETF | CW8, IWDA… | Yahoo Finance | Every 30 min |
| Precious metals | XAU (gold), XAG (silver) | Yahoo Finance futures (GC=F / SI=F) | Every 30 min |
| Cash / currency | USD, GBP, CHF… | Frankfurter (ECB rates) | Daily |
| CS2 skins | AK-47 Redline, Karambit… | market.csgo.com (bulk) | Every 35 min |
| Other | Custom asset | Manual only | — |

### Portfolio management

- Multiple portfolios with types (Crypto, Stocks, ETF, Metals, Mixed)
- Transactions: buy, sell, swap, transfer
- Weighted average cost basis calculation
- P&L per position (absolute and percentage)
- Filter positions by portfolio and asset type
- CSV export / import
- Excel import (Bourse Direct format supported)

### Dashboard

- Total portfolio value, total cost, global P&L
- 24h change
- Performance chart (24h, 7d, 30d, 1y, all)
- Allocation breakdown by category
- Auto-refresh every 5 minutes

### CS2 skins — how it works

1. **Initial import**: enter a Steam profile URL or SteamID64. The app fetches the full CS2 inventory (up to 3,000 items, paginated with a delay between pages to avoid Steam rate-limiting). Each skin is created as an asset and a buy transaction is recorded at the current market price.
2. **minValue filter**: skins where `price × quantity < minValue` are skipped (default: 1 €). Avoids importing hundreds of worthless stickers.
3. **Delta re-sync**: after the initial import, the Re-sync button compares the current Steam inventory with quantities already tracked. Only new skins or increased quantities are imported. Sold skins are not affected — selling remains manual.
4. **Linked profiles**: import settings (target portfolio, currency, minValue) are saved per Steam profile to simplify future re-syncs.

### Wallet monitoring

- Bitcoin (blockchain.info) and Ethereum (Blockchair)
- Detects new transactions every hour
- Web push notification (VAPID) sent on new transaction detection
- Portfolio transaction creation remains manual

### Other

- **Privacy mode**: navbar toggle that blurs all monetary amounts (CSS blur), persists across sessions
- **Price snapshots**: prices stored in DB every 30 minutes, used to reconstruct the performance chart history
- **Auth**: rolling 8h sessions + JWT for mobile use. Registration can be disabled via `REGISTRATION_ENABLED=false`
- Dark theme

---

## External APIs

| API | Used for | Key required | Limit |
|---|---|---|---|
| [CoinGecko](https://www.coingecko.com/en/api) | Crypto prices | No | ~30 req/min (free tier) |
| [Yahoo Finance](https://finance.yahoo.com) | Stocks, ETFs, metals | No | Unofficial endpoint, no documented limit |
| [CryptoCompare](https://min-api.cryptocompare.com) | Historical crypto prices | No | 100k calls/month (free tier) |
| [Frankfurter](https://www.frankfurter.app) | Currency conversion (ECB rates) | No | No documented limit |
| [market.csgo.com](https://market.csgo.com) | CS2 skin prices (bulk USD) | No | No documented limit |
| [Steam](https://steamcommunity.com) | CS2 inventory fetch, profile name | No (optional for vanity URLs) | Inventory must be public; rate-limited at ~1 req/1.5s |
| [Blockchair](https://blockchair.com) | Ethereum wallet transactions | No | ~1,500 req/day (free tier) |
| [blockchain.info](https://blockchain.info) | Bitcoin wallet transactions | No | No documented limit |

---

## Deploy on a server

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/)

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/Marcla30/selfolio.git
cd selfolio
```

**2. Configure environment**
```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
```env
POSTGRES_PASSWORD=a_strong_password    # change this
DATABASE_URL=postgresql://portfolio:a_strong_password@db:5432/portfolio_tracker

# Generate with: openssl rand -base64 32
SESSION_SECRET=
JWT_SECRET=

# Your domain (used for CORS)
CORS_ORIGIN=https://your-domain.com
```

**3. Start**
```bash
docker compose up -d
```

The database schema is applied automatically on first start.

**4. Access the app**

Open `http://your-server-ip:3000` (or the `APP_PORT` set in `.env`).

Create your account on the registration page. You can disable registration afterwards by setting `REGISTRATION_ENABLED=false` in `.env` and restarting.

### Update

```bash
git pull
docker compose up -d --build
```

### Useful commands

```bash
# View logs
docker compose logs -f app

# Force refresh all prices
docker compose exec app node -e "require('./src/jobs/priceSnapshot').saveDailyPrices()"

# Diagnose Yahoo Finance connectivity
docker compose exec app node scripts/test-yahoo.js

# Stop
docker compose down

# Stop and delete all data (irreversible)
docker compose down -v
```

---

## Local development

```bash
npm install
cp .env.example .env
# Edit .env with a local DATABASE_URL
npx prisma migrate dev
npm run dev
```

With Docker and live reload:
```bash
cat > docker-compose.override.yml <<EOF
services:
  app:
    volumes:
      - ./src:/app/src
      - ./public:/app/public
EOF
docker compose up -d
```

---

## Tech stack

- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL
- **Frontend:** Vanilla JS, Chart.js
- **Mobile:** React Native (Expo)
- **Deployment:** Docker, Docker Compose

## Architecture

```
/src
  /routes       - API route handlers
  /services     - Business logic (prices, wallets, CS2…)
  /middleware   - Authentication
  /jobs         - Cron jobs (price snapshots, wallet sync)
/public
  /controllers  - Frontend controllers (SPA)
  /services     - Frontend API client
  /styles       - CSS
/prisma
  schema.prisma - Database schema
/scripts
  test-yahoo.js - Yahoo Finance connectivity diagnostic
```
