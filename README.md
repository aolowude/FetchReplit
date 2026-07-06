# Fetch — your pocket nutritionist

Fetch is an AI-powered food discovery and nutrition PWA. Snap a meal for instant macros and a health score, manage a smart fridge, generate recipes, and curate a memory of preferences that personalises every suggestion.

This repo was exported from Replit and adapted for **local development** with a remote Postgres database (Neon recommended) and a dev auth bypass so you can run it without Replit OIDC.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22+ (24 recommended) |
| pnpm | 9+ |

Install pnpm if needed:

```bash
npm install -g pnpm
```

Or run commands via `npx pnpm` without a global install.

---

## Quick start

### 1. Clone and install

```bash
git clone <repo-url>
cd FetchReplit
pnpm install
```

### 2. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (see [Database](#database) below) |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | [OpenRouter](https://openrouter.ai/) API key for food scan + recipe AI |
| `DEV_AUTH=1` | Bypass Replit login; every request runs as `dev@fetch.local` |
| `VITE_DEV_AUTH=1` | Same bypass on the frontend |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8080` | API server port |
| `WEB_PORT` | `5173` | Vite dev server port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | Allowed origins for credentialed requests |

### 3. Start the app

The easiest way — installs deps, pushes the DB schema, and starts both servers:

```bash
pnpm start
```

Then open:

- **Web app:** http://localhost:5173
- **API health check:** http://localhost:8080/api/healthz

You are automatically signed in as the local dev user (`dev@fetch.local`).

### 4. Stop the app

```bash
pnpm stop
```

---

## Database

Fetch uses PostgreSQL via Drizzle ORM. For local development, use a **remote Neon database** rather than running Postgres locally.

### Neon setup

1. Create a project at [console.neon.tech](https://console.neon.tech)
2. Copy the **pooled** connection string (recommended for serverless/server apps)
3. Set it in `.env`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-HOST/neondb?sslmode=require
```

4. Push the schema:

```bash
pnpm --filter @workspace/db run push
```

`pnpm start` runs this automatically on each start.

### Local Postgres (optional)

If `DATABASE_URL` points at `localhost:5432`, `pnpm start` will attempt to boot an embedded Postgres via Python `pgserver` (requires a `.venv` with `pgserver` installed). For most setups, Neon is simpler.

---

## Running the app

### All-in-one (recommended)

```bash
pnpm start      # start API + web, push schema
pnpm stop       # stop everything
pnpm restart    # restart
pnpm status     # show process state
pnpm logs       # tail combined log
pnpm reset      # drop and re-push DB schema (destructive)
```

### Run services separately

Useful when you want to restart one side without the other:

```bash
pnpm dev:all    # API + web in parallel (no schema push)
pnpm dev:api    # API only (port 8080)
pnpm dev:web    # Web only (port 5173, proxies /api → 8080)
```

The API `dev` script rebuilds on each start (no watch mode). After editing backend routes, restart the API:

```bash
pnpm dev:api
# or
pnpm restart
```

---

## Local dev auth

When `DEV_AUTH=1` and `VITE_DEV_AUTH=1` are set:

- No Replit OIDC login is required
- The API authenticates every request as a fixed dev user (`dev-user-local` / `dev@fetch.local`)
- The dev user is bootstrapped into the `users` table on first request
- The Login button on the web app just navigates to Home

**Do not enable `DEV_AUTH` in production.**

---

## Development commands

```bash
pnpm run typecheck                              # typecheck all packages
pnpm --filter @workspace/api-spec run codegen   # regenerate API client from OpenAPI spec
pnpm --filter @workspace/db run push            # push schema to database
pnpm run build                                  # full build (typecheck + all packages)
```

---

## Project structure

```
FetchReplit/
├── artifacts/
│   ├── api-server/     # Express 5 API
│   └── fetch/          # React + Vite web client (PWA)
├── lib/
│   ├── api-spec/       # OpenAPI contract (source of truth)
│   ├── api-zod/        # Generated Zod schemas
│   ├── api-client-react/  # Generated React Query hooks
│   ├── db/             # Drizzle schema + migrations
│   └── replit-auth-*/  # Replit OIDC auth (bypassed in dev)
├── scripts/
│   ├── app.sh          # start/stop/status wrapper
│   └── load-env.mjs    # .env loader for dev scripts
├── .env.example        # env template
└── replit.md           # extended architecture notes
```

---

## Troubleshooting

### `pnpm: command not found`

Use npx:

```bash
npx pnpm install
npx pnpm start
```

### API not responding

Check logs:

```bash
pnpm logs
```

Verify the health endpoint:

```bash
curl http://localhost:8080/api/healthz
# → {"status":"ok"}
```

### Database connection errors

- Confirm `DATABASE_URL` is set and reachable
- For Neon, use the **pooler** URL and include `?sslmode=require`
- Re-push schema: `pnpm --filter @workspace/db run push`

### Port already in use

Stop any existing instance:

```bash
pnpm stop
```

Or change ports in `.env` (`API_PORT`, `WEB_PORT`).

### AI features fail (scan, recipes, suggestions)

Ensure `AI_INTEGRATIONS_OPENROUTER_API_KEY` is set in `.env` with a valid OpenRouter key.

### Frontend can't reach API

In local dev, Vite proxies `/api/*` to `http://localhost:8080`. Make sure both `pnpm dev:web` and `pnpm dev:api` are running, or use `pnpm start` / `pnpm dev:all`.

---

## Stack

- **Monorepo:** pnpm workspaces, TypeScript 5.9
- **API:** Express 5, Drizzle ORM, PostgreSQL
- **Web:** React, Vite, wouter, TanStack Query, Tailwind
- **AI:** OpenRouter (`openai/gpt-4o-mini` for vision + text)
- **Auth (production):** Replit OIDC + PKCE

For architecture details and product notes, see [`replit.md`](./replit.md).
