# Portfolio Tracker

Full-stack investment tracking application inspired by Delta.

## Features

- Track crypto, stocks, ETFs, metals, and custom assets
- Real-time price updates from multiple free APIs
- Portfolio statistics and performance analytics
- Wallet monitoring with push notifications
- Multi-portfolio support
- Dark mode UI

## Quick Start

1. Copy environment variables:
```bash
cp .env.example .env
```

2. Start with Docker Compose:
```bash
docker-compose up -d
```

3. Access the application:
- App: http://localhost:3000
- PgAdmin (dev): http://localhost:5050

## Development

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Tech Stack

- Backend: Node.js, Express, Prisma, PostgreSQL
- Frontend: Vanilla JS, Chart.js
- APIs: CoinGecko, Yahoo Finance, Frankfurter, Blockchair
- Deployment: Docker, Docker Compose

## Architecture

```
/src
  /routes       - API route handlers
  /services     - Business logic
  /middleware   - Auth and other middleware
  /jobs         - Cron jobs
/public
  /controllers  - Frontend controllers
  /services     - API client
  /styles       - CSS files
/prisma
  schema.prisma - Database schema
```
