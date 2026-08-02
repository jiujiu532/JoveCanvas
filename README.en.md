<p align="center">
  <img src="web/public/logo.svg?v=0.0.3" width="108" alt="JoveCanvas logo">
</p>

<h1 align="center">JoveCanvas</h1>

<p align="center">Open-source AI creation workspace for Agent chat, image & video workbenches, infinite canvas, and short-drama production</p>

<p align="center">
  <a href="./README.md">简体中文</a> ·
  <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/jiujiu532/JoveCanvas"><img src="https://img.shields.io/github/stars/jiujiu532/JoveCanvas?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v0.0.3-2563eb?style=flat-square" alt="Version"></a>
  <a href="https://github.com/jiujiu532/JoveCanvas/releases"><img src="https://img.shields.io/github/v/release/jiujiu532/JoveCanvas?style=flat-square&label=release" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-f97316?style=flat-square" alt="License"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs" alt="Next.js"></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql" alt="PostgreSQL"></a>
</p>

<p align="center">
  <a href="docs/index.md">Docs index</a> ·
  <a href="docs/content/docs/overview/project-structure.mdx">Project structure</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="https://github.com/jiujiu532/JoveCanvas/releases">Releases</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

**JoveCanvas** packs a unified creative Agent, image and video workbenches, an infinite canvas, short-drama production, a public works gallery, an asset library, and a commercial admin console into one Next.js full-stack app. PostgreSQL stores accounts and business data; media can land on local disk or S3-compatible object storage; model, payment, and storage secrets stay server-side only.

UI copy is **Simplified Chinese / English** via `next-intl` (cookie `NEXT_LOCALE`, no locale route prefix). The `docs/` site ships matching bilingual content.

## Highlights in v0.0.3

- **Durable Generation Worker** — leases, heartbeats, HMAC callbacks, and cross-instance resume for image / video / audio jobs.
- **Protocol hub** — OpenAI, Gemini, Seedance 2.0, Stable Diffusion, A1111/Forge, and custom protocols with logical-model failover.
- **Works gallery** — drafts, review, publish/share, search, likes / follows, and author profiles.
- **Commerce loop** — plans, promotions, coupons, invites, Alipay / WeChat / Stripe / PayPly payments, refunds, and reconciliation.
- **Full zh/en i18n** — workspace, admin, landing/gallery, and server-facing error strings switch with the UI language.
- **Install constraint** — v0.0.2 databases are **not** upgradeable in place; wipe and re-run `/install`.

Full notes: [CHANGELOG.md](CHANGELOG.md) and [GitHub Releases](https://github.com/jiujiu532/JoveCanvas/releases).

## Core features

- **Unified Agent** — text, image, video, and audio in one session; Skills, smart planning, manual logical models, server-side history.
- **Image / video workbenches** — text/image-to-image, text/image-to-video, references, history restore, retry, preview, and download.
- **Infinite canvas** — multi-type nodes, drag/connect, undo/redo, import/export, and Canvas Agent Run.
- **Short-drama pipeline** — script → content review → characters/scenes/props → storyboard → shots → voice/subtitles → versions → FFmpeg compose / Jianying export.
- **Prompts & assets** — public prompt library, my prompts, my assets; re-use into Agent / workbenches / canvas / drama.
- **Protocol hub & logical models** — admins own channels and bindings; end users never see upstream keys.
- **Commercial admin** — users, plans, points, CDK, orders, payments, refunds, ledger, works moderation, announcements, generation ops, audit.
- **Storage & backup** — local or S3-compatible media, reference-safe deletes, migration, redacted business import/export.

## Product flowcharts

Collapsed by default — expand a section to open it.

<details>
<summary><strong>01｜Public pages & auth</strong></summary>

```mermaid
flowchart LR
    HOME["Home"] --> ACTION{"Visitor"}
    ACTION --> ANN["Announcements"]
    ACTION --> LOGIN["Login"]
    ACTION --> REGISTER["Register"]
    ACTION --> FORGOT["Forgot password"]
    REGISTER --> LOGIN
    FORGOT --> LOGIN
    LOGIN --> SESSION["Session"]
    SESSION --> ROLE{"Role"}
    ROLE -->|User| USER["Workspace"]
    ROLE -->|Admin| ADMIN["Admin"]
    INSTALL["/install"] --> SCHEMA["Init schema"]
    SCHEMA --> FIRST_ADMIN["First admin"]
    FIRST_ADMIN --> ADMIN
```

</details>

<details>
<summary><strong>02｜User workspace</strong></summary>

```mermaid
flowchart TB
    USER["Workspace"]
    USER --> CREATE["Agent /create"]
    USER --> IMAGE["Image /image"]
    USER --> VIDEO["Video /video"]
    USER --> CANVAS["Canvas /canvas"]
    USER --> DRAMA["Drama /drama"]
    USER --> PROMPTS["Prompts"]
    USER --> ASSETS["Assets"]
    USER --> GALLERY["Gallery"]
    USER --> BILLING["Billing"]
    USER --> PROFILE["Profile"]
    USER --> HELP["Help"]
```

</details>

<details>
<summary><strong>03｜Generation flow</strong></summary>

```mermaid
flowchart TB
    START["Input / references"] --> ENTRY{"Entry"}
    ENTRY --> AGENT["Unified Agent"]
    ENTRY --> IMAGE["Image workbench"]
    ENTRY --> VIDEO["Video workbench"]
    AGENT --> CHECK["Capability / points check"]
    IMAGE --> CHECK
    VIDEO --> CHECK
    CHECK --> ROUTER["Logical model router"]
    ROUTER --> TASK["Idempotent task"]
    TASK --> WORKER["Generation Worker"]
    WORKER --> PROVIDER["Upstream"]
    PROVIDER --> POLL["Poll same task"]
    POLL --> RESULT{"Result"}
    RESULT -->|OK| MEDIA["Normalize & register media"]
    RESULT -->|Fail| REFUND["Keep failure & refund"]
    REFUND --> RETRY["User explicit retry"]
    RETRY --> TASK
```

</details>

<details>
<summary><strong>04｜Canvas</strong></summary>

```mermaid
flowchart LR
    LIST["/canvas"] --> EDITOR["/canvas/:id"]
    EDITOR --> NODE["Nodes: text/image/video/audio/gen"]
    NODE --> CONNECT["Drag & connect"]
    CONNECT --> RUN["Canvas Agent Run"]
    RUN --> SAVE["Server autosave"]
```

</details>

<details>
<summary><strong>05｜Short drama</strong></summary>

```mermaid
flowchart LR
    LIST["/drama"] --> EDITOR["/drama/:id"]
    EDITOR --> SCRIPT["Script"]
    SCRIPT --> REVIEW["Content review"]
    REVIEW --> ASSETS["Cast / scenes / props"]
    ASSETS --> STORYBOARD["Storyboard"]
    STORYBOARD --> SHOTS["Shots"]
    SHOTS --> AUDIO["Voice / SFX"]
    AUDIO --> SUB["Subtitles"]
    SUB --> VERSION["Versions"]
    VERSION --> COMPOSE["FFmpeg compose"]
```

</details>

<details>
<summary><strong>06｜Server data flow</strong></summary>

```mermaid
flowchart LR
    PAGE["Pages"] --> CLIENT["API service"]
    CLIENT --> ROUTE["Route Handler"]
    ROUTE --> AUTH["Session / auth"]
    AUTH --> SERVICE["Services"]
    SERVICE --> REPO["Repository"]
    REPO --> PG[("PostgreSQL 16")]
    SERVICE --> ROUTER["Logical model router"]
    ROUTER --> PROVIDER["Upstream"]
    SERVICE --> WORKER["Generation Worker"]
    SERVICE --> MEDIA["Media registry"]
    MEDIA --> LOCAL["Local"]
    MEDIA --> S3["Object storage"]
```

</details>

A generation task creates the upstream job once; polling always queries that same job. A new attempt is created only when the upstream has clearly failed **and** the user clicks retry. Planning prompts, model rationales, and review details stay internal — they are never shown or persisted into generative chat.

Full layout: [Project structure & flow](docs/content/docs/overview/project-structure.mdx).

## Minimum server sizing

JoveCanvas calls external AI models and does **not** need a GPU. The host mainly runs Web, PostgreSQL, media I/O, and optional FFmpeg.

| Use case | CPU | Memory | Disk | Notes |
| --- | --- | --- | --- | --- |
| Minimum boot | 1 core | 1GB + 1GB swap | 10GB SSD | Release image + external DB + external object storage; trial only |
| Small standard | 2 cores | 2GB + 1GB swap | 20GB SSD | App + DB co-located; do **not** build images on the server |
| Recommended daily | 2–4 cores | 4GB | 40GB+ SSD | Workbenches, canvas, admin, light concurrency |
| Drama / heavy video | 4+ cores | 8GB+ | 80GB+ SSD | FFmpeg and long video dominate CPU/RAM/disk |

Also: 64-bit Linux, Docker Compose v2, PostgreSQL 16, domain + HTTPS, outbound access to model upstreams. Source dev wants ≥ 2GB RAM. See [Low-memory deploy](docs/content/docs/overview/low-memory.mdx).

## Quick start

### Docker Compose

```bash
git clone https://github.com/jiujiu532/JoveCanvas.git
cd JoveCanvas
cp .env.example .env
```

Set at least:

```dotenv
NEXT_PUBLIC_SITE_URL=https://jove-canvas.example.com
POSTGRES_PASSWORD=replace-with-a-strong-password
VOZEB_PRO_ENCRYPTION_KEY=replace-with-openssl-rand-hex-32
VOZEB_PRO_MAINTENANCE_TOKEN=replace-with-another-openssl-rand-hex-32
```

> Runtime env vars still use the `VOZEB_PRO_*` prefix (matching the code). That does not change the public brand **JoveCanvas**.

```bash
openssl rand -hex 32
openssl rand -hex 32
docker compose pull
docker compose up -d
docker compose ps
```

Compose starts the main app and `generation-worker` together; both must share the same `VOZEB_PRO_MAINTENANCE_TOKEN` (≥ 32 chars). Open `https://your-domain/install` to initialize schema and create the first admin. The install page closes automatically when setup finishes.

Full env reference: [Configuration](docs/content/docs/overview/configuration.mdx).

### Baota + external PostgreSQL

```bash
docker compose -f docker-compose.baota.yml up -d
```

```dotenv
VOZEB_PRO_DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://user:password@127.0.0.1:5432/vozeb_pro
VOZEB_PRO_DATABASE_SSL=0
VOZEB_PRO_TRUSTED_PROXY_HOPS=1
```

Forward `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and `X-Forwarded-For` from Nginx. Details: [Docker deploy](docs/content/docs/overview/docker.mdx).

### Source development

Requirements: Node.js 22, pnpm 10+, PostgreSQL 16; FFmpeg for drama compose.

```bash
cp .env.example web/.env.local
cd web
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://localhost:3000/install`. Docs site:

```bash
cd docs
pnpm install --frozen-lockfile
pnpm run dev
```

## First-time setup order

1. Finish DB init and first admin on `/install`.
2. Configure model channels (protocol, connection, fetch models, verify).
3. Bind real upstream models to stable logical models and set defaults.
4. Configure plans, promotions / coupons / invites, points, and payments.
5. Configure SMTP, registration policy, local media or S3.
6. Walk the setup checklist; verify real generation, Worker resume, refunds, and backup restore.

## Project layout

| Path | What lives here |
| --- | --- |
| `web/` | Main app (Next.js 16 App Router, APIs, Worker scripts) |
| `web/src/app/` | Pages, layouts, install, workspace, admin, Route Handlers |
| `web/src/lib/server/` | Agent, routing, generation, billing, media, payments, security |
| `web/src/lib/server/database/` | Idempotent schema and repositories |
| `web/messages/{zh,en}/` | next-intl message catalogs |
| `web/scripts/` | Standalone start, Generation Worker, release checks, prompt import |
| `docs/` | Fumadocs site (zh + en) |
| `Dockerfile` / `docker-compose*.yml` | Production image and deploy topologies |
| `VERSION` / `CHANGELOG.md` | Version and changelog |
| `AGENTS.md` / `CONTRIBUTING.md` | Engineering constitution and contribution flow |
| `LICENSE` / `SECURITY.md` / `CLA.md` | AGPL-3.0, security policy, contributor terms |

## Data & security

- PostgreSQL stores users, sessions, settings, creative sessions, canvas, assets, drama, generation tasks, points, and orders.
- The external-storage flag only controls where **new** media is written; historical media is always read via the registered `storage_provider`.
- Business records keep a stable in-site `storageKey` — never base64, raw object keys, or temporary signed URLs.
- Do not commit `.env`, secrets, the database, media, backups, logs, or build artifacts.
- Production backups must cover **both** PostgreSQL and local media / object storage.

## Verification

```bash
cd web
pnpm test
pnpm run typecheck
pnpm run format:check
pnpm run build

cd ../docs
pnpm run types:check
pnpm run build
```

Before a release you can run `cd web && pnpm run check:release` (Compose / Render contracts + low-memory build).

## Docs & license

- [Feature overview](docs/content/docs/overview/features.mdx)
- [Project structure & flow](docs/content/docs/overview/project-structure.mdx)
- [Configuration](docs/content/docs/overview/configuration.mdx)
- [Database schema](docs/content/docs/backend/backend-database.mdx)
- [Pending tests](docs/content/docs/progress/pending-test.mdx)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [AGPL-3.0](LICENSE) · [CLA](CLA.md)
