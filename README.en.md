<p align="center">
  <img src="web/public/logo.svg?v=0.0.2" width="108" alt="VOZEB PRO logo">
</p>

<h1 align="center">VOZEB PRO</h1>

<p align="center">Open-source AI creation workspace for Agent chat, image & video workbenches, Canvas, and short-drama production</p>

<p align="center">
  <a href="./README.md">简体中文</a> ·
  <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/csyqlz/VOZEB-PRO"><img src="https://img.shields.io/github/stars/csyqlz/VOZEB-PRO?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v0.0.2-2563eb?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-f97316?style=flat-square" alt="License"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16.2-000000?style=flat-square&logo=nextdotjs" alt="Next.js"></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql" alt="PostgreSQL"></a>
</p>

<p align="center">
  <a href="https://www.vozeb.com">Demo</a> ·
  <a href="docs/index.md">Docs index</a> ·
  <a href="docs/content/docs/overview/project-structure.mdx">Project structure</a> ·
  <a href="docs/content/docs/overview/page-gallery.mdx">Page gallery</a> ·
  <a href="https://linux.do">LINUX DO</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

![VOZEB PRO home](docs/public/screenshots/pages/01-home.webp)

VOZEB PRO packs a unified creative Agent, image and video workbenches, an infinite canvas, short-drama production, an asset library, and a commercial admin console into one Next.js full-stack app. PostgreSQL stores accounts and business data; media can land on local disk or S3-compatible object storage; model, payment, and storage secrets stay server-side only.

## Core features

- **Unified Agent**: create text, image, video, and audio assets in one session — Skills, intelligent planning, manual logical models, server-side history, and stable assets.
- **Image workbench**: text-to-image, image-to-image, reference editing, multi-result runs, history restore, failure retry, WebP preview, and original download.
- **Video workbench**: text-to-video, image-to-video, multi-type references, duration / aspect / resolution params, async resume, and result management.
- **Canvas**: text, image, video, audio, and generation nodes with drag, connect, zoom, undo/redo, import/export, and Agent Run.
- **Short-drama pipeline**: script, content review, characters/scenes/props, storyboard, shot video, voice, subtitles, versions, and FFmpeg compose.
- **Model routing**: admins maintain channels, protocols, real models, logical models, capabilities, priority, and defaults — end users never see upstream keys.
- **Commercial admin**: users, plans, points, CDK, orders, payments, refunds, ledger, announcements, prompts, generation ops, and audit logs.
- **Storage & backup**: local media, S3-compatible object storage, reference-safe deletes, object migration, and redacted business data import/export.

## Product flowcharts

All flowcharts are collapsed by default. Expand a section title to open it — they are not all shown at once.

<details>
<summary><strong>01｜Public pages & auth</strong></summary>

```mermaid
flowchart LR
    HOME["Home /<br/>product intro, feature entry, announcements"] --> ACTION{"Visitor choice"}

    ACTION --> ANN["Announcements /announcements<br/>pinned notices and platform news"]
    ACTION --> LOGIN["Login /login<br/>account password check"]
    ACTION --> REGISTER["Register /register<br/>policy and optional email OTP"]
    ACTION --> FORGOT["Forgot password /forgot-password<br/>email OTP and reset"]
    ACTION --> PRIVACY["Privacy /privacy"]
    ACTION --> TERMS["Terms /terms"]

    REGISTER --> LOGIN
    FORGOT --> LOGIN
    LOGIN --> SESSION["Create login session"]
    SESSION --> ROLE{"Account role"}
    ROLE -->|User| USER["User workspace"]
    ROLE -->|Admin| ADMIN["Commercial SaaS admin"]

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

    USER --> CREATE["Unified Agent /create<br/>multimodal creation and server sessions"]
    USER --> IMAGE["Image workbench /image<br/>T2I, I2I, reference edit"]
    USER --> VIDEO["Video workbench /video<br/>T2V and I2V"]

    USER --> CANVAS["Canvas projects /canvas<br/>create, search, rename, delete"]
    CANVAS --> CANVAS_ID["Canvas editor /canvas/:id"]

    USER --> DRAMA["Drama projects /drama<br/>project and production progress"]
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

    MY_PROMPTS --> CREATE
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
    LIST --> SEARCH["Search projects"]
    LIST --> RENAME["Rename project"]
    LIST --> DELETE["Delete project"]
    LIST --> OPEN["Open project"]

    CREATE --> EDITOR["Canvas editor /canvas/:id"]
    OPEN --> EDITOR

    EDITOR --> NODE{"Add node"}
    NODE --> TEXT["Text node"]
    NODE --> IMAGE["Image node"]
    NODE --> VIDEO["Video node"]
    NODE --> AUDIO["Audio node"]
    NODE --> GENERATE["Generation node"]

    TEXT --> CONNECT["Drag, zoom, and connect nodes"]
    IMAGE --> CONNECT
    VIDEO --> CONNECT
    AUDIO --> CONNECT
    GENERATE --> CONNECT

    CONNECT --> AGENT["Start Canvas Agent Run"]
    AGENT --> PLAN["Analyze nodes and connections"]
    PLAN --> TASK["Create image, video, or audio subtasks"]
    TASK --> RESULT["Write results back to nodes"]
    RESULT --> HISTORY["Undo, redo, and history"]
    HISTORY --> SAVE["Autosave to server"]
    SAVE --> EDITOR
```

</details>

<details>
<summary><strong>05｜Short-drama production</strong></summary>

```mermaid
flowchart LR
    LIST["Drama projects /drama"] --> CREATE["Create drama project"]
    CREATE --> CONFIG["Set episodes, aspect, shots"]
    CONFIG --> EDITOR["Drama editor /drama/:id"]

    EDITOR --> SCRIPT["Phase 1: generate or edit script"]
    SCRIPT --> REVIEW["Phase 2: content review and human confirm"]
    REVIEW --> ASSETS["Phase 3: characters, scenes, props"]
    ASSETS --> STORYBOARD["Phase 4: storyboard and shot design"]
    STORYBOARD --> SHOTS["Phase 5: generate shot images and videos"]

    SHOTS --> AUDIO["Generate voice, SFX, and BGM"]
    AUDIO --> SUBTITLE["Generate and proof subtitles"]
    SUBTITLE --> VERSION["Save script, storyboard, and media versions"]
    VERSION --> COMPOSE["Compose final with FFmpeg"]
    COMPOSE --> CHECK{"Compose result"}

    CHECK -->|Success| EXPORT["Preview and export final"]
    CHECK -->|Failure| FIX["Locate failed shot or audio"]
    FIX --> SHOTS
```

</details>

<details>
<summary><strong>06｜Prompts, assets, account, and billing</strong></summary>

```mermaid
flowchart TB
    PROMPTS["Public prompts /prompts"] --> FIND["Category, tag, and keyword search"]
    FIND --> USE["Use in Agent, image, or video creation"]

    MY["My prompts /my-prompts"] --> MANAGE["Create, edit, categorize, tag, delete"]
    MANAGE --> SAVE_ASSET["Save as text asset"]
    MANAGE --> USE

    ASSETS["My assets /assets"] --> FILTER["Filter image, video, audio, text, files"]
    FILTER --> PREVIEW["Preview or download"]
    FILTER --> CONTINUE["Send to Agent, workbench, Canvas, or drama"]
    FILTER --> DELETE["Delete after business-reference checks"]

    HELP["Help center /help"] --> GUIDE["Agent, image, video, Canvas, drama, account guides"]

    PROFILE["Profile /profile"] --> INFO["Edit profile and password"]
    PROFILE --> RIGHTS["View points, plan, orders, spend history"]
    PROFILE --> EXPORT["Export personal data"]
    PROFILE --> CANCEL_ACCOUNT["Submit account deletion request"]
    CANCEL_ACCOUNT --> ADMIN_REVIEW["Admin accept or reject"]

    BILLING["Billing /billing"] --> PRODUCT["Pick plan or points product"]
    PRODUCT --> ORDER["Create pending order"]
    ORDER --> CHECKOUT["Checkout /billing/checkout"]
    CHECKOUT --> CHANNEL["Choose available payment channel"]
    CHANNEL --> PAY{"Payment result"}

    PAY -->|Success| SUCCESS["Success /billing/success"]
    SUCCESS --> CONFIRM["Confirm webhook and order status"]
    CONFIRM --> GRANT["Grant plan or points"]
    GRANT --> REFRESH["Refresh balance and order history"]

    PAY -->|Cancel or fail| CANCEL["Cancel /billing/cancel"]
    CANCEL --> CHOICE{"Order handling"}
    CHOICE -->|Continue pay| CHECKOUT
    CHOICE -->|Abandon| CLOSE["Close or keep pending order"]
```

</details>

<details>
<summary><strong>07｜Commercial SaaS ops & finance</strong></summary>

```mermaid
flowchart TB
    ADMIN["Admin /admin"] --> ANALYSIS["Business analytics"]
    ADMIN --> PRODUCT["Product ops"]
    ADMIN --> FINANCE["Finance"]

    ANALYSIS --> OVERVIEW["Dashboard<br/>users, revenue, points liability, orders, generation"]
    ANALYSIS --> USERS["User ops<br/>create user, role, status, plan, points"]
    ANALYSIS --> LOGS["Call logs<br/>user, entry, model, status, failure reason"]
    ANALYSIS --> GENERATION["Generation ops<br/>task query, cancel, failure, retry"]

    PRODUCT --> PRODUCTS["Plans<br/>price, benefits, payment type, publish"]
    PRODUCT --> ORDERS["Orders<br/>query, manual complete, close, refund"]

    FINANCE --> POINTS["Points rules<br/>free quota, model price, param multipliers"]
    FINANCE --> PAYMENTS["Payment channels<br/>merchant config, callbacks, probe, enable"]
    FINANCE --> CDK["CDK<br/>batch generate, filter, disable, redeem tracking"]
    FINANCE --> WALLET["Ledger<br/>top-up, charge, refund, balance change"]

    BILLING_ADMIN["Billing ops /admin/billing"] --> ORDERS
    BILLING_ADMIN --> PRODUCTS
    BILLING_ADMIN --> PAYMENTS

    PRODUCTS --> USER_BUY["User picks product"]
    USER_BUY --> ORDERS
    ORDERS --> PAYMENTS
    PAYMENTS --> PAY_RESULT{"Payment result"}

    PAY_RESULT -->|Success| WALLET
    PAY_RESULT -->|Failure| REFUND["Close order or refund"]
    REFUND --> WALLET

    POINTS --> GENERATION
    GENERATION --> WALLET
```

</details>

<details>
<summary><strong>08｜Upstream models, system, storage, content</strong></summary>

```mermaid
flowchart TB
    ADMIN["Admin /admin"] --> UPSTREAM["Upstream config"]
    ADMIN --> SYSTEM["System"]
    ADMIN --> STORAGE["Storage & backup"]
    ADMIN --> CONTENT["Content ops"]

    UPSTREAM --> CHANNELS["Model channels<br/>protocol, Base URL, API Key, catalog"]
    CHANNELS --> DETECT["Probe text, image, video, audio"]
    DETECT --> LOGICAL["Bind logical models, priority, defaults"]
    UPSTREAM --> SKILLS["Agent Skills<br/>category, triggers, capability constraints, enable"]

    SYSTEM --> SITE["Site profile<br/>name, logo, SEO, home content, friend links"]
    SYSTEM --> SETTINGS["Base settings<br/>register, SMTP, defaults, concurrency, security"]
    SYSTEM --> DELETION["Deletion requests<br/>filter, accept, reject, notes"]
    SYSTEM --> UPDATES["Version updates<br/>current version, releases, logs, upgrade check"]

    STORAGE --> LOCAL["Local media<br/>category, ownership, TTL, reference-safe delete"]
    STORAGE --> S3["External storage<br/>S3 config, probe, object management, migrate"]
    STORAGE --> BACKUP["Data backup<br/>import/export and full-backup boundary"]

    CONTENT --> ANNOUNCEMENT["Announcements<br/>create, edit, pin, publish, unpublish"]
    CONTENT --> PROMPT["Prompts<br/>search, category, tags, visibility"]

    SETUP["Setup /admin/setup"] --> SITE
    SETUP --> CHANNELS
    SETUP --> SETTINGS
    SETUP --> PRODUCTS["Plan products"]
    SETUP --> PAYMENTS["Payment channels"]
    SETUP --> S3
    SETUP --> BACKUP

    ANNOUNCEMENT --> PUBLIC_ANN["User announcements"]
    PROMPT --> PUBLIC_PROMPT["Public prompt library"]
    LOGICAL --> GENERATION["User generation tasks"]
    SKILLS --> GENERATION
```

</details>

<details>
<summary><strong>09｜End-to-end server data flow</strong></summary>

```mermaid
flowchart LR
    PAGE["All user and admin pages"] --> CLIENT["Frontend API service"]
    CLIENT --> ROUTE["Next.js Route Handler"]
    ROUTE --> AUTH["Session, ownership, role auth"]
    AUTH --> SERVICE["Business services and task orchestration"]

    SERVICE --> REPO["Repository<br/>parameterized queries and transactions"]
    REPO --> PG[("PostgreSQL 16")]

    SERVICE --> ROUTER["Logical model router"]
    ROUTER --> PROVIDER["External AI models"]
    PROVIDER --> TASK["Idempotent task and status poll"]

    TASK --> BILLING["Points charge and plan usage"]
    BILLING --> PG

    TASK -->|Failure or cancel| REFUND["Idempotent refund"]
    REFUND --> PG

    TASK --> MEDIA["Media download, normalize, register"]
    MEDIA --> SWITCH{"Storage target"}
    SWITCH -->|Local| LOCAL["Server data directory"]
    SWITCH -->|External| S3["S3-compatible object storage"]
    MEDIA --> PG

    PG --> RESPONSE["Unified response code / data / msg"]
    LOCAL --> RESPONSE
    S3 --> RESPONSE
    RESPONSE --> PAGE
```

</details>

A generation task calls the upstream create API only once; polling always queries the same task. A new attempt is created only when the upstream has clearly failed and the user clicks retry — this avoids double spend. Platform planning prompts, model rationales, and review details are for internal execution only and are never shown or persisted into generative chat.

For full directory ownership, Agent, media, billing, and deploy notes, see [Project structure & flow](docs/content/docs/overview/project-structure.mdx).

## Minimum server sizing

VOZEB PRO calls external AI models and does **not** require a GPU. The server mainly runs Web, PostgreSQL, media download/storage, and optional FFmpeg transcoding.

| Use case | CPU | Memory | Disk | Notes |
| --- | --- | --- | --- | --- |
| Minimum boot | 1 core | 1GB + 1GB swap | 10GB SSD | Release image + external PostgreSQL + external S3/OSS; install trial / low concurrency only |
| Small standard deploy | 2 cores | 2GB + 1GB swap | 20GB SSD | App + PostgreSQL on one host; light multi-user; do **not** build images on the server |
| Recommended daily use | 2–4 cores | 4GB | 40GB+ SSD | Image/video workbenches, Canvas, admin, light concurrency |
| Drama compose or heavy local video | 4+ cores | 8GB+ | 80GB+ SSD | FFmpeg, long video download/transcode/subtitle burn use CPU, RAM, and temp disk hard |

Also required at minimum: 64-bit Linux, Docker + Compose v2, PostgreSQL 16, a usable domain + HTTPS, and outbound access to model upstreams. Source development or on-host builds want at least 2GB RAM (4GB is safer). Size disk to actual media volume when keeping video locally. Full guide: [Low-memory deploy](docs/content/docs/overview/low-memory.mdx).

## Quick start

### Docker Compose

Requirements: a Linux host that can run Docker Compose, an HTTPS domain, and model channels as needed.

```bash
git clone https://github.com/csyqlz/VOZEB-PRO.git
cd VOZEB-PRO
cp .env.example .env
```

Set at least:

```dotenv
NEXT_PUBLIC_SITE_URL=https://vozeb-pro.example.com
POSTGRES_PASSWORD=replace-with-a-strong-password
VOZEB_PRO_ENCRYPTION_KEY=replace-with-openssl-rand-hex-32
```

Generate the encryption key and start:

```bash
openssl rand -hex 32
docker compose pull
docker compose up -d
docker compose ps
```

Open `https://your-domain/install`, check the database, initialize schema, and create the first admin.

### Baota (BT Panel) + PostgreSQL

When Baota already runs PostgreSQL:

```bash
docker compose -f docker-compose.baota.yml up -d
```

Point `.env` at the host loopback database:

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

Open `http://localhost:3000/install`. The docs site runs independently under `docs/`:

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
| `web/src/app/` | Next.js pages, layouts, install, user workspace, admin, and same-origin API Route Handlers |
| `web/src/lib/server/` | Agent orchestration, model routing, generation tasks, billing, media, object storage, payments, server security |
| `web/src/lib/server/database/` | PostgreSQL schema, parameterized repositories, query mapping, file-provider fallback |
| `web/src/components/` / `web/src/hooks/` | Cross-page UI, workbench controllers, asset pickers, copy/download, session UX |
| `web/src/services/api/` / `web/src/stores/` | Typed browser→own-API clients; transient user / theme / config / asset state |
| `web/scripts/` | Standalone start, admin password reset, pre-release checks |
| `web/public/` | Site logo, browser icon, model brand marks |
| `docs/content/docs/` | Feature, install, deploy, database, commercial readiness, progress, and troubleshooting docs |
| `docs/public/screenshots/` | Redacted WebP screenshots for user, public, and admin pages |
| `.github/workflows/quality.yml` | Web + docs install, typecheck, tests, format check, production build |
| `.github/workflows/docker-image.yml` | Main app amd64/arm64 image build and GHCR multi-arch merge |
| `.github/workflows/docs-docker-image.yml` | Docs site amd64/arm64 image build and GHCR multi-arch merge |
| `.env.example` | Database, site, encryption, proxy, media, model, payment, and deploy env template |
| `Dockerfile` / `docker-compose*.yml` | Standalone production image; standard, source, Baota, external-DB, and low-mem topologies |
| `VERSION` / `CHANGELOG.md` | Current version and version-level changelog |
| `LICENSE` / `CLA.md` / `SECURITY.md` | AGPL-3.0, contributor terms, vulnerability reporting |
| `AGENTS.md` / `CONTRIBUTING.md` | Engineering constitution; how to file issues and send code/docs |

Full tree, key source entrypoints, and Service / Route Handler / Repository / task-store ownership: [Project structure & flow](docs/content/docs/overview/project-structure.mdx).

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/public/screenshots/pages/03a-canvas-editor.webp" alt="Canvas editor"></td>
    <td width="50%"><img src="docs/public/screenshots/pages/04a-drama-editor.webp" alt="Drama production editor"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/public/screenshots/pages/05-image-workbench.webp" alt="Image workbench"></td>
    <td width="50%"><img src="docs/public/screenshots/pages/06-video-workbench.webp" alt="Video workbench"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/public/screenshots/pages/20-admin-overview.webp" alt="Admin dashboard"></td>
    <td width="50%"><img src="docs/public/screenshots/pages/34-admin-channels.webp" alt="Model channels"></td>
  </tr>
</table>

42 redacted feature screenshots across user, public, and admin surfaces: [Page gallery](docs/content/docs/overview/page-gallery.mdx).

## Data & security

- PostgreSQL stores users, sessions, settings, creative sessions, Canvas, assets, drama, generation tasks, points, and orders.
- With external storage off, new media writes only to `VOZEB_PRO_DATA_DIR`; with it on, new media writes only to S3-compatible object storage. Historical media is always read via the registered provider.
- Business records keep a stable in-site `storageKey` — never base64, raw object keys, or temporary signed URLs.
- Do not commit `.env`, API keys, payment secrets, the database, media files, backups, logs, or build artifacts.
- Production backups must cover **both** PostgreSQL and local media / object storage — not one without the other.

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

## Community

<table>
  <tr>
    <td width="260"><a href="https://qm.qq.com/q/9MVLTxuRd6"><img src="docs/public/community/qq-vozeb-group-1049777515.webp" width="240" alt="VOZEB open-source QQ group QR"></a></td>
    <td>
      <strong>VOZEB open-source chat</strong><br>
      QQ group: <code>1049777515</code> · <a href="https://qm.qq.com/q/9MVLTxuRd6">Join the group</a><br><br>
      Discuss deploy, model-channel adapters, workbench usage, bug reproduction, and code contributions. Do <strong>not</strong> post API keys, database passwords, payment secrets, server private keys, or unredacted production logs in the group.
    </td>
  </tr>
</table>

## Acknowledgements

- Thanks to original open-source author **basketikun** for canvas creative workflows, Canvas Agent, and Codex plugin capabilities.
- Thanks to the [LINUX DO](https://linux.do) community, related open prompt repositories, the Codex / Claude Code ecosystem, and every open-source tool and infrastructure this project builds on.
