# addd

A Node.js + TypeScript REST API starter with Express, Jest, ESLint, and Prettier — ready to extend.

[![CI](https://github.com/lgstudio144-ctrl/addd/actions/workflows/ci.yml/badge.svg)](https://github.com/lgstudio144-ctrl/addd/actions/workflows/ci.yml)

---

## Architecture

```
src/
  config.ts          – Environment/config loading (dotenv)
  app.ts             – Express application factory
  server.ts          – Entry point; starts HTTP listener
  routes/
    index.ts         – Mounts all route groups
    health.ts        – GET /api/v1/health
  middleware/
    errorHandler.ts  – Centralised error-handling middleware
tests/
  health.test.ts     – Integration tests (Supertest)
```

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10

## Setup

```bash
git clone https://github.com/lgstudio144-ctrl/addd.git
cd addd
npm install
cp .env.example .env   # edit as needed
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |

## API

### `GET /api/v1/health`

Returns server liveness.

```json
{ "status": "ok", "timestamp": "2026-04-16T23:00:00.000Z" }
```

## Contributing

1. Fork → feature branch → PR against `main`
2. All CI checks (lint, format, test, build) must pass
3. Follow the existing code style (ESLint + Prettier enforce it)
