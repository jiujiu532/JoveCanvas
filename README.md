<p align="center">
  <img src="web/public/logo.svg?v=0.0.3" width="108" alt="JoveCanvas logo">
</p>

<h1 align="center">JoveCanvas</h1>

<p align="center">面向 Agent、图片、视频、无限画布与短剧生产的开源 AI 创作工作台</p>

<p align="center">
  <strong>简体中文</strong> ·
  <a href="./README.en.md">English</a>
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
  <a href="docs/index.md">文档索引</a> ·
  <a href="docs/content/docs/overview/project-structure.mdx">项目结构</a> ·
  <a href="CHANGELOG.md">更新记录</a> ·
  <a href="https://github.com/jiujiu532/JoveCanvas/releases">Releases</a> ·
  <a href="CONTRIBUTING.md">参与贡献</a>
</p>

**JoveCanvas** 把统一创作 Agent、图片 / 视频工作台、无限画布、短剧生产线、作品广场、素材库和商业运营后台放在同一套 Next.js 全栈应用中。PostgreSQL 保存账号与业务数据；媒体可写入服务器本地目录或 S3 兼容对象存储；模型、支付和存储密钥只在服务端使用。

界面文案支持 **简体中文 / English**（`next-intl`，Cookie `NEXT_LOCALE`，无路由前缀）；文档站 `docs/` 同步提供中英内容。

## v0.0.3 亮点

- **持久生成 Worker**：图片 / 视频 / 音频任务租约、心跳、HMAC 回调与跨实例续取；关页不丢任务。
- **协议中心**：OpenAI、Gemini、Seedance 2.0、Stable Diffusion、A1111/Forge 与自定义协议；逻辑模型多渠道故障转移。
- **作品广场**：草稿、审核、发布分享、广场检索、点赞 / 关注与作者主页。
- **商业闭环**：套餐促销、优惠券、邀请奖励、支付宝 / 微信 / Stripe / PayPly 等支付与整单退款对账。
- **全站中英双语**：前台工作区、管理后台、落地页 / 广场与服务端错误文案可切换语言。
- **安装约束**：不支持沿用 v0.0.2 数据库；须清空后经 `/install` 重新初始化。

更完整变更见 [CHANGELOG.md](CHANGELOG.md) 与 [GitHub Releases](https://github.com/jiujiu532/JoveCanvas/releases)。

## 核心功能

- **统一 Agent**：文字、图片、视频、音频同会话创作；Skill、智能规划、手动逻辑模型、服务端历史。
- **图片 / 视频工作台**：文生图 / 图生图、文生视频 / 图生视频、参考素材、历史恢复、失败重试、预览与下载。
- **无限画布**：多类型节点、拖拽连线、撤销重做、导入导出与 Canvas Agent Run。
- **短剧生产线**：剧本 → 内容审核 → 角色 / 场景 / 道具 → 分镜 → 镜头 → 配音字幕 → 版本 → FFmpeg 合成 / 剪映导出。
- **提示词与素材**：公共提示词库、我的提示词、我的素材；可回填到 Agent / 工作台 / 画布 / 短剧。
- **协议中心与逻辑模型**：管理员配置渠道与绑定；普通用户不接触上游密钥。
- **商业后台**：用户、套餐、积分、CDK、订单、支付、退款、对账、作品治理、公告、生成运维与审计。
- **存储与备份**：本地媒体 / S3 兼容存储、引用保护、对象迁移与脱敏业务数据导入导出。

## 项目功能流程

所有流程图默认折叠，点击标题展开。

<details>
<summary><strong>01｜公开页面与登录注册</strong></summary>

```mermaid
flowchart LR
    HOME["首页"] --> ACTION{"访客选择"}
    ACTION --> ANN["公告"]
    ACTION --> LOGIN["登录"]
    ACTION --> REGISTER["注册"]
    ACTION --> FORGOT["找回密码"]
    REGISTER --> LOGIN
    FORGOT --> LOGIN
    LOGIN --> SESSION["Session"]
    SESSION --> ROLE{"角色"}
    ROLE -->|用户| USER["用户工作区"]
    ROLE -->|管理员| ADMIN["管理后台"]
    INSTALL["/install"] --> SCHEMA["初始化库表"]
    SCHEMA --> FIRST_ADMIN["首个管理员"]
    FIRST_ADMIN --> ADMIN
```

</details>

<details>
<summary><strong>02｜用户工作区导航</strong></summary>

```mermaid
flowchart TB
    USER["用户工作区"]
    USER --> CREATE["Agent /create"]
    USER --> IMAGE["图片 /image"]
    USER --> VIDEO["视频 /video"]
    USER --> CANVAS["画布 /canvas"]
    USER --> DRAMA["短剧 /drama"]
    USER --> PROMPTS["提示词"]
    USER --> ASSETS["素材"]
    USER --> GALLERY["作品广场"]
    USER --> BILLING["充值"]
    USER --> PROFILE["个人中心"]
    USER --> HELP["帮助"]
```

</details>

<details>
<summary><strong>03｜生成任务流程</strong></summary>

```mermaid
flowchart TB
    START["输入 / 参考素材"] --> ENTRY{"入口"}
    ENTRY --> AGENT["统一 Agent"]
    ENTRY --> IMAGE["图片工作台"]
    ENTRY --> VIDEO["视频工作台"]
    AGENT --> CHECK["能力 / 积分校验"]
    IMAGE --> CHECK
    VIDEO --> CHECK
    CHECK --> ROUTER["逻辑模型路由"]
    ROUTER --> TASK["幂等生成任务"]
    TASK --> WORKER["Generation Worker"]
    WORKER --> PROVIDER["上游模型"]
    PROVIDER --> POLL["轮询同一任务"]
    POLL --> RESULT{"结果"}
    RESULT -->|成功| MEDIA["规范化并登记媒体"]
    RESULT -->|失败| REFUND["保留失败并退款"]
    REFUND --> RETRY["用户显式重试"]
    RETRY --> TASK
```

</details>

<details>
<summary><strong>04｜画布创作</strong></summary>

```mermaid
flowchart LR
    LIST["/canvas"] --> EDITOR["/canvas/:id"]
    EDITOR --> NODE["节点：文本/图/视频/音频/生成"]
    NODE --> CONNECT["拖拽连线"]
    CONNECT --> RUN["Canvas Agent Run"]
    RUN --> SAVE["服务端自动保存"]
```

</details>

<details>
<summary><strong>05｜短剧生产</strong></summary>

```mermaid
flowchart LR
    LIST["/drama"] --> EDITOR["/drama/:id"]
    EDITOR --> SCRIPT["剧本"]
    SCRIPT --> REVIEW["内容审核"]
    REVIEW --> ASSETS["角色/场景/道具"]
    ASSETS --> STORYBOARD["分镜"]
    STORYBOARD --> SHOTS["镜头"]
    SHOTS --> AUDIO["配音/音效"]
    AUDIO --> SUB["字幕"]
    SUB --> VERSION["版本"]
    VERSION --> COMPOSE["FFmpeg 合成"]
```

</details>

<details>
<summary><strong>06｜服务端数据流</strong></summary>

```mermaid
flowchart LR
    PAGE["页面"] --> CLIENT["API Service"]
    CLIENT --> ROUTE["Route Handler"]
    ROUTE --> AUTH["Session / 权限"]
    AUTH --> SERVICE["业务服务"]
    SERVICE --> REPO["Repository"]
    REPO --> PG[("PostgreSQL 16")]
    SERVICE --> ROUTER["逻辑模型路由"]
    ROUTER --> PROVIDER["上游"]
    SERVICE --> WORKER["Generation Worker"]
    SERVICE --> MEDIA["媒体登记"]
    MEDIA --> LOCAL["本地"]
    MEDIA --> S3["对象存储"]
```

</details>

一条生成任务只调用一次上游创建接口；轮询始终查询同一任务。仅在上游明确失败且用户点击重试时才会创建新 attempt。平台规划提示词、模型理由与复盘详情只用于内部执行，不写入生成型对话。

完整目录与部署说明见 [项目结构与流程](docs/content/docs/overview/project-structure.mdx)。

## 最低服务器配置

JoveCanvas 调用外部 AI 模型，**不需要 GPU**。服务器主要承担 Web、PostgreSQL、媒体下载 / 存储和可选 FFmpeg。

| 使用方式 | CPU | 内存 | 磁盘 | 说明 |
| --- | --- | --- | --- | --- |
| 最低可启动 | 1 核 | 1GB + 1GB swap | 10GB SSD | 发布镜像 + 外部库 + 外部对象存储；仅安装体验 |
| 标准小型部署 | 2 核 | 2GB + 1GB swap | 20GB SSD | 应用与数据库同机；勿在服务器现场构建镜像 |
| 推荐日常使用 | 2–4 核 | 4GB | 40GB+ SSD | 工作台、画布、后台与少量并发 |
| 短剧 / 重视频 | 4 核+ | 8GB+ | 80GB+ SSD | FFmpeg 与长视频占用明显 |

另需：64 位 Linux、Docker Compose v2、PostgreSQL 16、域名 + HTTPS、可访问模型上游的出站网络。源码开发建议 ≥ 2GB 内存。详见 [低内存服务器部署](docs/content/docs/overview/low-memory.mdx)。

## 快速开始

### Docker Compose

```bash
git clone https://github.com/jiujiu532/JoveCanvas.git
cd JoveCanvas
cp .env.example .env
```

至少修改：

```dotenv
NEXT_PUBLIC_SITE_URL=https://jove-canvas.example.com
POSTGRES_PASSWORD=replace-with-a-strong-password
VOZEB_PRO_ENCRYPTION_KEY=replace-with-openssl-rand-hex-32
VOZEB_PRO_MAINTENANCE_TOKEN=replace-with-another-openssl-rand-hex-32
```

> 运行时环境变量仍使用 `VOZEB_PRO_*` 前缀（与代码一致），不影响对外品牌 **JoveCanvas**。

```bash
openssl rand -hex 32
openssl rand -hex 32
docker compose pull
docker compose up -d
docker compose ps
```

Compose 默认同时启动主应用与 `generation-worker`，两者必须共用同一个 `VOZEB_PRO_MAINTENANCE_TOKEN`（≥ 32 字符）。打开 `https://你的域名/install` 完成库表初始化与首个管理员创建；安装完成后安装页自动关闭。

完整变量说明：[配置说明](docs/content/docs/overview/configuration.mdx)。

### 宝塔 + 外部 PostgreSQL

```bash
docker compose -f docker-compose.baota.yml up -d
```

```dotenv
VOZEB_PRO_DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://user:password@127.0.0.1:5432/vozeb_pro
VOZEB_PRO_DATABASE_SSL=0
VOZEB_PRO_TRUSTED_PROXY_HOPS=1
```

Nginx 需转发 `Host`、`X-Forwarded-Host`、`X-Forwarded-Proto`、`X-Forwarded-For`。详见 [Docker 部署](docs/content/docs/overview/docker.mdx)。

### 源码开发

要求：Node.js 22、pnpm 10+、PostgreSQL 16；短剧合成另需 FFmpeg。

```bash
cp .env.example web/.env.local
cd web
pnpm install --frozen-lockfile
pnpm run dev
```

访问 `http://localhost:3000/install`。文档站：

```bash
cd docs
pnpm install --frozen-lockfile
pnpm run dev
```

## 首次配置顺序

1. `/install` 初始化数据库并创建首个管理员。
2. 后台「模型渠道」配置协议、连接、拉取模型并验证能力。
3. 将真实上游模型绑定为稳定逻辑模型，设置默认值。
4. 配置套餐、促销 / 优惠券 / 邀请、积分规则与支付渠道。
5. 配置 SMTP、注册策略、本地媒体或 S3。
6. 走「初始化配置」清单，验证真实生成、Worker 续取、退款与备份恢复。

## 项目文件

| 路径 | 内容 |
| --- | --- |
| `web/` | 主应用（Next.js 16 App Router、API、Worker 脚本） |
| `web/src/app/` | 页面、布局、安装向导、用户区、后台、Route Handler |
| `web/src/lib/server/` | Agent、路由、生成任务、计费、媒体、支付、安全 |
| `web/src/lib/server/database/` | 幂等 schema 与 Repository |
| `web/messages/{zh,en}/` | next-intl 文案目录 |
| `web/scripts/` | standalone 启动、Generation Worker、发布检查、提示词导入 |
| `docs/` | Fumadocs 文档站（中英） |
| `Dockerfile` / `docker-compose*.yml` | 生产镜像与多种拓扑 |
| `VERSION` / `CHANGELOG.md` | 版本与变更 |
| `AGENTS.md` / `CONTRIBUTING.md` | 工程约束与贡献流程 |
| `LICENSE` / `SECURITY.md` / `CLA.md` | AGPL-3.0、安全与贡献者协议 |

## 数据与安全

- PostgreSQL 保存用户、会话、设置、创作会话、画布、素材、短剧、生成任务、积分与订单。
- 外部存储开关只影响**新媒体**写入位置；历史媒体按登记 `storage_provider` 读取。
- 业务记录只存稳定 `storageKey`，不存 base64、对象 Key 或临时签名 URL。
- 禁止提交 `.env`、密钥、数据库、媒体、备份、日志与构建产物。
- 生产备份须同时覆盖 PostgreSQL 与本地媒体 / 对象存储。

## 验证

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

发布前可执行 `cd web && pnpm run check:release`（含 Compose / Render 契约与低内存构建）。

## 文档与协议

- [功能总览](docs/content/docs/overview/features.mdx)
- [项目结构与流程](docs/content/docs/overview/project-structure.mdx)
- [配置说明](docs/content/docs/overview/configuration.mdx)
- [数据库结构](docs/content/docs/backend/backend-database.mdx)
- [待测试](docs/content/docs/progress/pending-test.mdx)
- [参与贡献](CONTRIBUTING.md) · [安全策略](SECURITY.md) · [AGPL-3.0](LICENSE) · [贡献者协议](CLA.md)
