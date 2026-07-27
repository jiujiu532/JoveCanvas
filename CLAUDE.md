# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

VOZEB PRO is an open-source AI creation workspace (Agent chat, image/video generation, an infinite canvas, and short-drama production) built as a Next.js full-stack monorepo-style repo with two independent apps:

- `web/` — the main application (Next.js 16, App Router, React 19, TypeScript). All product features, API routes, and business logic live here.
- `docs/` — a Fumadocs-based documentation site, built and deployed independently of `web/`.

There is no root `package.json`; each app is installed and run separately with pnpm.

**Read `AGENTS.md` in the repo root before making any change.** It is the authoritative, actively-maintained engineering constitution for this repo (backend layering, frontend state rules, admin UI conventions, canvas theming, documentation placement, release process, and a growing list of hard-won "project gotchas"). This CLAUDE.md summarizes architecture for orientation; `AGENTS.md` overrides it on any conflict and must be followed literally.

## Commands

All commands run from `web/` unless noted. Requires Node.js 22, pnpm 10+, PostgreSQL 16 (FFmpeg additionally required for short-drama rendering/local transcoding).

```bash
cd web
pnpm install --frozen-lockfile
cp ../.env.example .env.local     # then set NEXT_PUBLIC_SITE_URL, DATABASE_URL/POSTGRES_*, VOZEB_PRO_ENCRYPTION_KEY
pnpm run dev                      # next dev --webpack -H 0.0.0.0 -p 3000
```

Then open `http://localhost:3000/install` to initialize the database schema and create the first admin account (there is no separate migration CLI — see Database section below).

Quality gate (run before considering any change done, per `AGENTS.md`):

```bash
cd web
pnpm run typecheck        # tsc --noEmit --pretty false
pnpm test                 # vitest run
pnpm run format:check     # prettier --check .
pnpm run build             # next build
```

Run a single test file or pattern:

```bash
pnpm exec vitest run src/lib/server/billing-service.test.ts
pnpm exec vitest run -t "refund"     # filter by test name
```

Tests are colocated with implementation as `*.test.ts(x)` (Vitest, `@` aliased to `src/`).

Other scripts:

```bash
pnpm run format                    # prettier --write .
pnpm run start:standalone          # node scripts/start-standalone.mjs — Docker/standalone prod entrypoint
pnpm run reset:admin-password      # node scripts/reset-admin-password.mjs
pnpm run check:release             # node scripts/release-check.mjs — version/branding/doc/git-tracked-file checks before a release
```

Docs site (independent app, own quality gate):

```bash
cd docs
pnpm install --frozen-lockfile
pnpm run dev
pnpm run types:check   # next typegen && generate:source && tsc --noEmit
pnpm run build
```

There is no lint script configured; `typecheck` + `format:check` are the static checks.

## Architecture

### Request flow

Browser page/component → `web/src/services/api/*` (typed fetch client) → `web/src/app/api/**/route.ts` (Route Handler: parses input, checks session/admin auth, calls a service, maps result to `{ code, data, msg }`) → `web/src/lib/server/*` (business services, task orchestration, provider adapters) → `web/src/lib/server/database/*` (parameterized Repository) → PostgreSQL.

Route Handlers must stay thin — no business rules or raw SQL in `app/api/**/route.ts`. Business invariants are validated in the service/helper layer; uniqueness, transactions, and concurrency are enforced in the persistence layer. Pages never talk to the database or external model APIs directly; upstream API keys are decrypted and used server-side only.

### Directory map (`web/src/`)

| Path | Responsibility |
|---|---|
| `app/(user)/` | Logged-in workspace: Agent, image/video workbenches, Canvas, drama production, assets, prompts, profile |
| `app/admin/` | Admin console and install/setup wizard entry |
| `app/api/` | Route Handlers only — auth, service calls, response mapping |
| `components/` | Shared layout, cross-page business components, admin views |
| `hooks/` | Cross-page reusable hooks (generation flows, copy/download-with-toast, session sync) |
| `services/api/` | Typed browser→own-API request clients |
| `stores/` | Zustand global client state (user, theme, public site config, assets) — transient only |
| `lib/*.ts` | Cross-cutting domain contracts (canvas, drama, prompts, model routing, payments) |
| `lib/auth/` | Session, user, permissions, points wallet, public settings |
| `lib/server/` | Business services, task orchestration, provider adapters, billing, media, security |
| `lib/server/database/` | PostgreSQL schema, parameterized repositories, file-provider fallback |

There is no `middleware.ts` — auth/install-state gating happens per route group, e.g. `app/(user)/layout.tsx` calls `getAuthenticatedPageAccess()` and redirects to `/install` or `/login` as needed. Sessions: PBKDF2-SHA256 (210k iterations) password hashing, opaque random session tokens in a `vozeb_pro_session` httpOnly cookie backed by a Postgres `sessions` table.

Key entry points worth reading first when orienting in a subsystem:

- `lib/server/agent-run-executor.ts` — Agent Run claim/execute/finalize lifecycle
- `lib/server/logical-model-router.ts` — logical model → real channel/upstream model resolution with failover candidates
- `lib/server/generation-task-store.ts` — shared state machine for async generation tasks (claim, cancel, stats)
- `lib/server/object-storage-service.ts` / `local-media-registry.ts` — S3-compatible vs local media storage, both registered through the same media table
- `lib/server/database/schema.ts` — single source of truth for the Postgres schema
- `lib/server/database/repositories.ts` — repository aggregation entry point
- `services/api/request.ts` — shared response parsing/error mapping for the browser API client

### Agent execution engine

Agent Runs are created and executed asynchronously: `POST /api/agent/runs` creates a record, then `after()` triggers `executeAgentRun` post-response. Each execution attempt is tagged with an `executionId`; updates are compare-and-swap against `(executionId, status)` so concurrent executors can't stomp each other (this is what makes pause/resume/cancel safe). Execution has two phases:

1. **Plan** — a function-call tool (`create_agent_plan`) run against the default text model returns a structured task graph (`AgentRunTask[]` with dependencies).
2. **Execute** — tasks run in dependency-topological order; each dispatches to the relevant task API (`/api/image-tasks`, `/api/video-generation-tasks`, `/api/audio-tasks`, `/api/text-tasks`) and polls to a terminal state, then writes results back as canvas ops (`add_node`/`connect_nodes`/...) or plain text.

Image/video workbenches use a lighter single-shot planner (`workbench-agent-service.ts` + `plan_workbench_action` tool) that returns a parameter patch and skill selection rather than a multi-task graph.

**Hard rule from `AGENTS.md`**: planning prompts, model-selection rationale, creative briefs, and review details are for internal execution only — never surface or persist them into the generation chat. A subtask that has already created an upstream job must never silently create another one on timeout/poll-failure; only an explicit user retry may start a new attempt.

### Model routing

"Logical models" (stable IDs configured in the admin console) resolve via `logical-model-router.ts` to a prioritized list of `(channel, upstream model)` bindings, filtered by enabled/healthy channels, giving multi-channel failover. Pricing, quota, and refund logic must all key off the logical model ID (upstream model name is only a compatibility read path) — see the pricing rules in `AGENTS.md` "项目注意事项" before touching billing/refund code.

### Database

~40 tables defined as one large idempotent SQL string in `lib/server/database/schema.ts` (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` + data backfills). **There is no up/down migration system** — the install wizard (`/install`, `lib/server/install-status.ts`) runs the whole script to bring any environment to the current target state. When you change the schema, edit this file directly and keep every statement idempotent; also update `docs/content/docs/backend/backend-database.mdx` (required by `AGENTS.md`).

Table names get a `vozeb_pro_` prefix injected at runtime via regex (`prefixPostgresSql`) so the schema source stays unprefixed and readable. Access goes through `pg` `Pool` (no ORM) via per-domain Repository classes aggregated in `repositories.ts`.

A `VOZEB_PRO_DATABASE_PROVIDER=file` mode exists as a server-side JSON-file fallback for parts of the auth/settings layer — most business domains (billing, canvas, drama) are Postgres-only.

### Storage

Media can be written to local disk (`VOZEB_PRO_DATA_DIR`) or an S3-compatible object store, toggled by one `object_storage_settings.enabled` flag. The flag only changes where *new* writes go — existing rows keep the `storage_provider` they were written with and are always read back through that provider. Business records store a stable internal `storageKey`, never a raw object key or a signed URL. Deleting media must check references from creative sessions, canvas projects, drama projects, and the asset library first — never leave a dangling reference.

### Billing/points

Dual-account wallet: permanent points + daily plan-quota points (reset at UTC+8 midnight). Every credit/debit/refund call takes an idempotency key so retries can't double-charge or double-refund. Orders go `pending → paid → (refunding) → refunded`, refunds use a claim-token pattern to survive concurrent refund attempts and provider callback races. Supported payment providers: Stripe, Alipay, WeChat Pay (native), plus a field-mappable generic/custom provider. Webhooks are verified, deduped by provider event ID, then routed through the same `completeBillingOrderPayment` path orders use elsewhere.

### Short-drama pipeline

`Project → Episode[] → Shot[]`. Script analysis runs in two explicitly separated phases — `content` (dialogue/character/scene extraction only) and `visual` (shot prompts/camera/continuity) — and the visual phase is only ever invoked after content has been reviewed, to avoid leaking unreviewed creative content. Versioning is a separate `drama_project_versions` table using row locks + `MAX(version)+1`; restoring a version snapshots the current state first so restores are themselves reversible. Final render is done by `lib/server/ffmpeg.ts` (thin `spawn` wrapper) orchestrated from `app/api/drama/render/route.ts`: per-shot scale/pad/audio-mux via `filter_complex`, concat-demuxer stitch, then optional server-generated SRT burned in via the `subtitles=` filter. A separate export path (`drama-jianying-export.ts`, using the `jsjianyingdraft` package) packages a project into a Jianying (剪映) draft folder.

## Conventions worth knowing before editing

These are the highlights most likely to bite; the full, current list lives in `AGENTS.md` and takes precedence over this summary.

- Global/cross-page state → `stores/`; consume it directly from the store/hook in components — don't thread it through props "for purity."
- Page-private hooks live next to the page (`admin/assets/use-admin-assets.ts`); only hooks actually reused across pages move to top-level `hooks/`.
- No client-side persistence (localStorage/IndexedDB/localforage) of business data — creative sessions, generation history, canvas/drama projects must be server-saved and restored per user.
- Canvas UI must use `canvasThemes` / `useThemeStore` / antd `ConfigProvider` tokens — never hardcode colors, or dark mode breaks.
- Every clickable element needs explicit light/dark/hover/disabled states with real contrast — no black-on-black or low-contrast icon-on-background.
- Admin sidebar sections are fixed by business role (经营分析/商品运营/财务管理/上游配置/系统管理/内容运营) — payment/CDK/ledger go under 财务管理, model channels/Agent Skills go under 上游配置.
- Chinese UI copy throughout; code comments/identifiers in English/Chinese per existing file convention.
- Baota-specific host-network/proxy-hop defaults belong only in `docker-compose.baota.yml`/install docs — never in the shared app defaults.
- After every change: run the relevant automated checks, then do the mandated browser regression pass (desktop + mobile, canvas node/link interactions, image/video workbench generate+history+reference flows, all touched buttons). Report explicitly if the full matrix couldn't be run.

## Deployment topologies

Five Docker Compose variants share the same image and DB schema: `docker-compose.yml` (bundled Postgres), `docker-compose.baota.yml` (host network, external Baota-managed Postgres), `docker-compose.external-db.yml`, `docker-compose.lowmem.yml` (384MB Node heap cap), plus `render.yaml` for Render.com. `Dockerfile` is a multi-stage pnpm + Next `standalone` build with ffmpeg and CJK fonts baked in. Don't test with local Docker builds/`docker run`/`docker compose` per the user's global environment policy — verify through `pnpm run build` + `pnpm run dev` instead.
