<p align="center">
  <img src="web/public/logo.svg?v=0.0.5" width="108" alt="JoveCanvas logo">
</p>

<h1 align="center">JoveCanvas</h1>

<p align="center">AI creation workspace for Agent chat, image & video workbenches, infinite canvas, and short-drama production</p>

<p align="center">
  <a href="./README.md">简体中文</a> ·
  <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/jiujiu532/JoveCanvas"><img src="https://img.shields.io/github/stars/jiujiu532/JoveCanvas?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v0.0.3-2563eb?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-f97316?style=flat-square" alt="License"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs" alt="Next.js"></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql" alt="PostgreSQL"></a>
</p>

<p align="center">
  <a href="docs/index.md">Docs index</a> ·
  <a href="docs/content/docs/overview/project-structure.mdx">Project structure</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

**JoveCanvas** packs a unified creative Agent, image and video workbenches, an infinite canvas, short-drama production, an asset library, and a commercial admin console into one Next.js full-stack app. PostgreSQL stores accounts and business data; media can land on local disk or S3-compatible object storage; model, payment, and storage secrets stay server-side only.

## Core features

- **Unified Agent**: create text, image, video, and audio assets in one session — Skills, intelligent planning, manual logical models, server-side history, and stable assets.
- **Image workbench**: text-to-image, image-to-image, reference editing, multi-result runs, history restore, failure retry, WebP preview, and original download.
- **Video workbench**: text-to-video, image-to-video, multi-type references, duration / aspect / resolution params, async resume, and result management.
- **Infinite canvas**: text, image, video, audio, and generation nodes with drag, connect, zoom, undo/redo, import/export, and Agent Run.
- **Short-drama pipeline**: script, content review, characters / scenes / props, storyboard, shot video, voice, subtitles, versions, and FFmpeg compose.
- **Model routing**: admins maintain channels, protocols, real models, logical models, capabilities, priority, and defaults — end users never see upstream keys.
- **Commercial admin**: users, plans, points, CDK, orders, payments, refunds, ledger, announcements, prompts, generation ops, and audit logs.
- **Storage & backup**: local media, S3-compatible object storage, reference-safe deletes, object migration, and redacted business data import/export.

## Product flowcharts

All flowcharts are collapsed by default. Expand a section title to open it.

<details>
<summary><strong>01｜Public pages & auth</strong></summary>

```mermaid
flowchart LR
    HOME["Home /<br/>product intro, entry, announcements"] --> ACTION{"Visitor choice"}

    ACTION --> ANN["Announcements /announcements"]
    ACTION --> LOGIN["Login /login"]
    ACTION --> REGISTER["Register /register"]
    ACTION --> FORGOT["Forgot password /forgot-password"]
    ACTION --> PRIVACY["Privacy /privacy"]
    ACTION --> TERMS["Terms /terms"]

    REGISTER --> LOGIN
    FORGOT --> LOGIN
    LOGIN --> SESSION["Create login session"]
    SESSION --> ROLE{"Account role"}
    ROLE -->|User| USER["User workspace"]
    ROLE -->|Admin| ADMIN["Admin console"]

    INSTALL["Install wizard /install"] --> CHECK["Check runtime and PostgreSQL"]
    CHECK --> SCHEMA["Initialize database schema"]
    SCHEMA --> FIRST_ADMIN["Create first admin"]
    FIRST_ADMIN --> ADMIN
```

</details>

<details>
<summary><strong>02｜User workspace navigation</strong></summary>

```mermaid
flowchart TB
    USER["User workspace<br/>load user, points, models, site config"]

    USER --> CREATE["Unified Agent /create"]
    USER --> IMAGE["Image workbench /image"]
    USER --> VIDEO["Video workbench /video"]

    USER --> CANVAS["Canvas projects /canvas"]
    CANVAS --> CANVAS_ID["Canvas editor /canvas/:id"]

    USER --> DRAMA["Drama projects /drama"]
    DRAMA --> DRAMA_ID["Drama editor /drama/:id"]

    USER --> PROMPTS["Public prompts /prompts"]
    USER --> MY_PROMPTS["My prompts /my-prompts"]
    USER --> ASSETS["My assets /assets"]
    USER --> HELP["Help center /help"]
    USER --> PROFILE["Profile /profile"]
    USER --> BILLING["Billing /billing"]

    PROMPTS --> CREATE
    PROMPTS --> IMAGE
    PROMPTS --> VIDEO
    ASSETS --> CREATE
    ASSETS --> IMAGE
    ASSETS --> VIDEO
    ASSETS --> CANVAS_ID
    ASSETS --> DRAMA_ID
```

</details>

<details>
<summary><strong>03｜Agent, image, and video generation</strong></summary>

```mermaid
flowchart TB
    START["User enters text or reference media"] --> ENTRY{"Creation entry"}

    ENTRY -->|Unified create| AGENT["Unified Agent"]
    ENTRY -->|Image| IMAGE["Image workbench"]
    ENTRY -->|Video| VIDEO["Video workbench"]

    AGENT --> SKILL["Pick Skill, smart plan, or logical model"]
    IMAGE --> IMAGE_PARAM["Set refs, ratio, quality, count"]
    VIDEO --> VIDEO_PARAM["Set refs, duration, ratio, resolution"]

    SKILL --> CHECK["Validate capability, media, params, points"]
    IMAGE_PARAM --> CHECK
    VIDEO_PARAM --> CHECK

    CHECK --> ROUTER["Logical model router"]
    ROUTER --> CREATE_TASK["Create idempotent generation task"]
    CREATE_TASK --> PROVIDER["Call text / image / video / audio upstream"]
    PROVIDER --> POLL["Poll the same upstream task"]
    POLL --> RESULT{"Task result"}

    RESULT -->|Success| NORMALIZE["Download and normalize media"]
    RESULT -->|Failure| FAILED["Keep failure record and refund"]
    FAILED --> RETRY["User explicitly retries"]
    RETRY --> CREATE_TASK

    NORMALIZE --> SAVE["Register media ownership and stable URL"]
    SAVE --> MESSAGE["Return to current creative session"]
    MESSAGE --> OPERATE["Preview, download, save asset, or continue"]
```

</details>

<details>
<summary><strong>04｜Canvas creation</strong></summary>

```mermaid
flowchart LR
    LIST["Canvas projects /canvas"] --> CREATE["Create canvas"]
    LIST --> OPEN["Open project"]
    CREATE --> EDITOR["Canvas editor /canvas/:id"]
    OPEN --> EDITOR

    EDITOR --> NODE{"Add node"}
    NODE --> TEXT["Text"]
    NODE --> IMAGE["Image"]
    NODE --> VIDEO["Video"]
    NODE --> AUDIO["Audio"]
    NODE --> GENERATE["Generation"]

    TEXT --> CONNECT["Drag, zoom, and connect"]
    IMAGE --> CONNECT
    VIDEO --> CONNECT
    AUDIO --> CONNECT
    GENERATE --> CONNECT

    CONNECT --> AGENT["Start Canvas Agent Run"]
    AGENT --> PLAN["Analyze nodes and connections"]
    PLAN --> TASK["Create image / video / audio subtasks"]
    TASK --> RESULT["Write results back to nodes"]
    RESULT --> SAVE["Autosave to server"]
```

</details>

<details>
<summary><strong>05｜Short-drama production</strong></summary>

```mermaid
flowchart LR
    LIST["Drama projects /drama"] --> CREATE["Create project"]
    CREATE --> CONFIG["Set episodes, aspect, shots"]
    CONFIG --> EDITOR["Drama editor /drama/:id"]

    EDITOR --> SCRIPT["Script"]
    SCRIPT --> REVIEW["Content review and confirm"]
    REVIEW --> ASSETS["Characters / scenes / props"]
    ASSETS --> STORYBOARD["Storyboard and shot design"]
    STORYBOARD --> SHOTS["Shot images and videos"]
    SHOTS --> AUDIO["Voice / SFX / BGM"]
    AUDIO --> SUBTITLE["Subtitles"]
    SUBTITLE --> VERSION["Version save"]
    VERSION --> COMPOSE["FFmpeg compose"]
    COMPOSE --> EXPORT["Preview and export"]
```

</details>

<details>
<summary><strong>06｜Prompts, assets, account, and billing</strong></summary>

```mermaid
flowchart TB
    PROMPTS["Public prompts /prompts"] --> USE["Use in Agent / image / video"]
    MY["My prompts /my-prompts"] --> USE
    ASSETS["My assets /assets"] --> CONTINUE["Send to Agent / workbench / canvas / drama"]

    PROFILE["Profile /profile"] --> INFO["Profile and password"]
    PROFILE --> RIGHTS["Points, plan, orders"]
    BILLING["Billing /billing"] --> ORDER["Create order"]
    ORDER --> CHECKOUT["Checkout /billing/checkout"]
    CHECKOUT --> GRANT["Grant plan or points"]
```

</details>

<details>
<summary><strong>07｜Admin ops and finance</strong></summary>

```mermaid
flowchart TB
    ADMIN["Admin /admin"] --> ANALYSIS["Business analytics"]
    ADMIN --> PRODUCT["Product ops"]
    ADMIN --> FINANCE["Finance"]

    ANALYSIS --> OVERVIEW["Dashboard"]
    ANALYSIS --> USERS["User ops"]
    ANALYSIS --> GENERATION["Generation ops"]
    PRODUCT --> PRODUCTS["Plans"]
    PRODUCT --> ORDERS["Orders"]
    FINANCE --> POINTS["Points rules"]
    FINANCE --> PAYMENTS["Payment channels"]
    FINANCE --> CDK["CDK"]
    FINANCE --> WALLET["Ledger"]
```

</details>

<details>
<summary><strong>08｜Models, system, storage, content</strong></summary>

```mermaid
flowchart TB
    ADMIN["Admin /admin"] --> UPSTREAM["Upstream config"]
    ADMIN --> SYSTEM["System"]
    ADMIN --> STORAGE["Storage and backup"]
    ADMIN --> CONTENT["Content ops"]

    UPSTREAM --> CHANNELS["Model channels"]
    CHANNELS --> LOGICAL["Logical models and defaults"]
    UPSTREAM --> SKILLS["Agent Skills"]
    SYSTEM --> SITE["Site profile"]
    SYSTEM --> SETTINGS["Base settings"]
    STORAGE --> LOCAL["Local media"]
    STORAGE --> S3["S3-compatible storage"]
    CONTENT --> ANNOUNCEMENT["Announcements"]
    CONTENT --> PROMPT["Prompt library"]
```

</details>

<details>
<summary><strong>09｜Server data flow</strong></summary>

```mermaid
flowchart LR
    PAGE["Pages"] --> CLIENT["Frontend API service"]
    CLIENT --> ROUTE["Route Handler"]
    ROUTE --> AUTH["Session and auth"]
    AUTH --> SERVICE["Business services"]
    SERVICE --> REPO["Repository"]
    REPO --> PG[("PostgreSQL 16")]
    SERVICE --> ROUTER["Logical model router"]
    ROUTER --> PROVIDER["Upstream models"]
    PROVIDER --> TASK["Idempotent task and poll"]
    TASK --> BILLING["Points charge"]
    TASK --> MEDIA["Media register"]
    MEDIA --> LOCAL["Local directory"]
    MEDIA --> S3["Object storage"]
    MEDIA --> PG
```

</details>

A generation task calls the upstream create API only once; polling always queries the same task. A new attempt is created only when the upstream has clearly failed and the user clicks retry — this avoids double spend. Platform planning prompts, model rationales, and review details are for internal execution only and are never shown or persisted into generative chat.

Full directory ownership, Agent, media, billing, and deploy notes: [Project structure & flow](docs/content/docs/overview/project-structure.mdx).

## Minimum server sizing

JoveCanvas calls external AI models and does **not** require a GPU. The server mainly runs Web, PostgreSQL, media download/storage, and optional FFmpeg transcoding.

| Use case | CPU | Memory | Disk | Notes |
| --- | --- | --- | --- | --- |
| Minimum boot | 1 core | 1GB + 1GB swap | 10GB SSD | Release image + external PostgreSQL + external object storage; install trial only |
| Small standard deploy | 2 cores | 2GB + 1GB swap | 20GB SSD | App + DB on one host; do **not** build images on the server |
| Recommended daily use | 2–4 cores | 4GB | 40GB+ SSD | Image/video workbenches, canvas, admin, light concurrency |
| Drama compose or heavy local video | 4+ cores | 8GB+ | 80GB+ SSD | FFmpeg and long video use CPU, RAM, and temp disk hard |

Also required at minimum: 64-bit Linux, Docker + Compose v2, PostgreSQL 16, a usable domain + HTTPS, and outbound access to model upstreams. Source development wants at least 2GB RAM (4GB is safer). Full guide: [Low-memory deploy](docs/content/docs/overview/low-memory.mdx).

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
```

> Note: runtime env vars still use the `VOZEB_PRO_*` prefix (matching current code). That does not change the public product brand **JoveCanvas**.

Generate the encryption key and start:

```bash
openssl rand -hex 32
docker compose pull
docker compose up -d
docker compose ps
```

Open `https://your-domain/install`, check the database, initialize schema, and create the first admin.

### Baota (BT Panel) + PostgreSQL

```bash
docker compose -f docker-compose.baota.yml up -d
```

```dotenv
VOZEB_PRO_DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://user:password@127.0.0.1:5432/vozeb_pro
VOZEB_PRO_DATABASE_SSL=0
VOZEB_PRO_TRUSTED_PROXY_HOPS=1
```

After Baota Nginx reverse-proxies the app, forward `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and `X-Forwarded-For`. Details: [Production readiness](docs/content/docs/overview/production-readiness.mdx) and [Docker deploy](docs/content/docs/overview/docker.mdx).

### Source development

Requirements: Node.js 22, pnpm 10+, PostgreSQL 16; FFmpeg for drama compose / local transcode.

```bash
cp .env.example web/.env.local
cd web
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://localhost:3000/install` (use the actual port if your local config differs). The docs site runs independently under `docs/`:

```bash
cd docs
pnpm install --frozen-lockfile
pnpm run dev
```

## First-time setup order

1. Finish DB init and first admin on `/install`.
2. Configure Base URL, API Key, protocol, and model catalog under admin **Model channels**.
3. Probe text / image / video / audio, create logical models, and set defaults.
4. Configure plans, points rules, and optional payment channels.
5. Configure SMTP, registration policy, local media or S3-compatible object storage.
6. Walk the **Setup** checklist, then verify real generation, refunds, and backup restore.

## Project layout

| Path | What lives here |
| --- | --- |
| `web/src/app/` | Next.js pages, layouts, install, user workspace, admin, and API Route Handlers |
| `web/src/lib/server/` | Agent orchestration, model routing, generation tasks, billing, media, object storage, payments, security |
| `web/src/lib/server/database/` | PostgreSQL schema, parameterized repositories, file-provider fallback |
| `web/src/components/` / `web/src/hooks/` | Cross-page UI, workbench controllers, asset pickers, session UX |
| `web/src/services/api/` / `web/src/stores/` | Typed browser→own-API clients; transient client state |
| `web/scripts/` | Standalone start, admin password reset, pre-release checks, prompt seed import |
| `web/public/` | Site logo, browser icon, model brand marks |
| `docs/content/docs/` | Feature, install, deploy, database, and troubleshooting docs |
| `docs/public/screenshots/` | Redacted feature screenshots |
| `.env.example` | Database, site, encryption, proxy, media, model, payment, and deploy env template |
| `Dockerfile` / `docker-compose*.yml` | Production image and deploy topologies |
| `VERSION` / `CHANGELOG.md` | Version and changelog |
| `LICENSE` / `CLA.md` / `SECURITY.md` | AGPL-3.0, contributor terms, vulnerability reporting |
| `AGENTS.md` / `CONTRIBUTING.md` | Engineering constitution and contribution flow |

Full tree and key entrypoints: [Project structure & flow](docs/content/docs/overview/project-structure.mdx).

## Data & security

- PostgreSQL stores users, sessions, settings, creative sessions, canvas, assets, drama, generation tasks, points, and orders.
- With external storage off, new media writes only to `VOZEB_PRO_DATA_DIR`; with it on, new media writes only to S3-compatible object storage. Historical media is always read via the registered provider.
- Business records keep a stable in-site `storageKey` — never base64, raw object keys, or temporary signed URLs.
- Do not commit `.env`, API keys, payment secrets, the database, media files, backups, logs, or build artifacts.
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

## Docs & license

- [Feature overview](docs/content/docs/overview/features.mdx)
- [Project structure & flow](docs/content/docs/overview/project-structure.mdx)
- [Configuration](docs/content/docs/overview/configuration.mdx)
- [Database schema](docs/content/docs/backend/backend-database.mdx)
- [Pending tests](docs/content/docs/progress/pending-test.mdx)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [AGPL-3.0](LICENSE)
- [Contributor agreement](CLA.md)
