# Fetch — your pocket nutritionist

Fetch is an AI-powered food discovery and nutrition PWA. Users sign in, snap a meal for instant macros and a health score, keep a living MyFridge, generate personalised recipes, and edit a memory of preferences/allergies/goals that warms every suggestion.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `PORT`)
- `pnpm --filter @workspace/fetch run dev` — run the Fetch web client
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `OPENROUTER_API_KEY` (Replit AI proxy), Replit Auth env vars
- Optional env: `CORS_ALLOWED_ORIGINS` — comma-separated allowlist for credentialed cross-origin requests (default: deny all cross-origin)

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- API: Express 5 + Drizzle ORM + PostgreSQL
- Auth: `@workspace/replit-auth-server` + `@workspace/replit-auth-web` (OIDC + PKCE)
- AI: OpenRouter via Replit AI proxy (`openai/gpt-4o-mini` for both vision food-scan and text recipe/suggestion JSON)
- Web: React + Vite + wouter + TanStack Query + Tailwind, shadcn-style UI, glassmorphism
- PWA: `public/manifest.webmanifest` + tiny `public/sw.js` shell cache (registered in prod only)

## Where things live

- Product spec: `attached_assets/Pasted-I-ll-update-the-PRD-...txt`
- API contract: `lib/api-spec/openapi.yaml` (single source of truth → Orval codegen → `lib/api-hooks`, `lib/api-zod`)
- DB schema: `lib/db/src/schema.ts` (users, profiles, memory facts, scans, fridge items)
- Backend routes: `artifacts/api-server/src/routes/{auth,profile,memory,scans,fridge,home}.ts`
- AI helper: `artifacts/api-server/src/lib/ai.ts` (`chatJson` with `response_format: json_object`)
- Web pages: `artifacts/fetch/src/pages/{login,home,scan,history,fridge,profile,memory}.tsx`
- Web shell + ring: `artifacts/fetch/src/components/{app-shell,health-ring}.tsx`
- Image resize util: `artifacts/fetch/src/lib/image.ts` (canvas → 1280px JPEG @ 0.85 before upload)
- Theme tokens: `artifacts/fetch/src/index.css` (peach / basil / cream / sourdough HSL palette + Outfit/Fraunces fonts)

## Architecture decisions

- **Drift from PRD**: PRD called for Next.js 14 App Router; the Replit workspace is a pnpm monorepo built around React + Vite + an Express API. Fetch is implemented on that scaffold so it slots into the existing artifact/codegen/auth conventions instead of bolting on a parallel Next stack.
- **Single AI gateway**: every LLM call goes through `chatJson()` which forces JSON-object responses, fixing schema drift at the boundary instead of in each route.
- **Image handling**: scans store the resized data URL on the row (no object storage dependency) so history is self-contained; the client downsizes before upload to keep payloads under the 12 MB Express limit.
- **Auth boundary**: every route guards on `req.isAuthenticated()` and scopes Drizzle queries by `user.id`; the frontend gates routes via `<Protected>` using `useAuth()` from `@workspace/replit-auth-web`.
- **CORS**: credentialed cross-origin is denied by default; trusted origins must be listed in `CORS_ALLOWED_ORIGINS`. The web client and API share an origin via the Replit proxy, so no CORS is needed in normal use.

## Product

Authenticated users land on a personalised Home (today's macros vs. target, AI suggestions tailored to memory + fridge, recent scans, expiring items), can scan any meal for macro/health analysis, browse history, manage MyFridge (manual add/edit + bulk add via vision + AI recipe generation), edit Profile preferences/allergies/goals, and curate a visible Memory of facts the AI uses.

## User preferences

_None recorded yet._

## Gotchas

- The api-server `dev` script is `build && start` (one-shot). After editing routes, **restart the workflow** — there's no watch mode.
- `lib/replit-auth-web/tsconfig.json` must keep `"composite": true` (project references requirement).
- After editing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before typechecking consumers.
- Service worker only registers in production builds (`import.meta.env.PROD`) — don't expect offline caching during `vite dev`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `replit-auth` skill for the auth integration this app uses
- See the `ai-integrations-openrouter` skill for the AI proxy
