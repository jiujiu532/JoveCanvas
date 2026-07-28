<p align="center">
  <img src="web/public/logo.svg?v=0.0.2" width="108" alt="JoveCanvas logo">
</p>

<h1 align="center">JoveCanvas</h1>

<p align="center">面向 Agent、图片、视频、无限画布与短剧生产的 AI 创作工作台</p>

<p align="center">
  <strong>简体中文</strong> ·
  <a href="./README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/jiujiu532/JoveCanvas"><img src="https://img.shields.io/github/stars/jiujiu532/JoveCanvas?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="VERSION"><img src="https://img.shields.io/badge/version-v0.0.2-2563eb?style=flat-square" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-f97316?style=flat-square" alt="License"></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs" alt="Next.js"></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat-square&logo=postgresql" alt="PostgreSQL"></a>
</p>

<p align="center">
  <a href="docs/index.md">文档索引</a> ·
  <a href="docs/content/docs/overview/project-structure.mdx">项目结构</a> ·
  <a href="docs/content/docs/overview/page-gallery.mdx">页面图册</a> ·
  <a href="CONTRIBUTING.md">参与贡献</a> ·
  <a href="CHANGELOG.md">更新记录</a>
</p>

![JoveCanvas 首页](docs/public/screenshots/pages/01-home.webp)

**JoveCanvas** 把统一创作 Agent、图片与视频工作台、无限画布、短剧生产、素材库和商业运营后台放在同一套 Next.js 全栈应用中。PostgreSQL 保存账号与业务数据；媒体可写入服务器本地目录或 S3 兼容对象存储；模型、支付和存储密钥只在服务端使用。

## 核心功能

- **统一 Agent**：文字、图片、视频和音频素材在同一会话中创作，支持 Skill、智能规划、手动逻辑模型、服务端历史和稳定资产。
- **图片工作台**：文生图、图生图、参考图编辑、多结果、历史恢复、失败重试、WebP 预览和原件下载。
- **视频工作台**：文生视频、图生视频、多类型参考素材、时长 / 比例 / 清晰度参数、异步续取和结果管理。
- **无限画布**：文本、图片、视频、音频与生成节点，支持拖拽、连线、缩放、撤销重做、导入导出和 Agent Run。
- **短剧生产线**：剧本、内容审核、角色 / 场景 / 道具、分镜、镜头视频、配音、字幕、版本和 FFmpeg 合成。
- **模型路由**：管理员维护渠道、协议、真实模型、逻辑模型、能力、优先级和默认值，普通用户不接触上游密钥。
- **商业后台**：用户、套餐、积分、CDK、订单、支付、退款、财务流水、公告、提示词、生成运营和审计日志。
- **存储与备份**：本地媒体、S3 兼容对象存储、引用保护、对象迁移和脱敏业务数据导入导出。

## 项目功能流程

所有流程图默认折叠，点击对应标题后即可查看，不会一次展示全部内容。

<details>
<summary><strong>01｜公开页面与登录注册流程</strong></summary>

```mermaid
flowchart LR
    HOME["首页 /<br/>产品介绍、功能入口、公告"] --> ACTION{"访客选择"}

    ACTION --> ANN["公告中心 /announcements"]
    ACTION --> LOGIN["登录 /login"]
    ACTION --> REGISTER["注册 /register"]
    ACTION --> FORGOT["找回密码 /forgot-password"]
    ACTION --> PRIVACY["隐私政策 /privacy"]
    ACTION --> TERMS["服务条款 /terms"]

    REGISTER --> LOGIN
    FORGOT --> LOGIN
    LOGIN --> SESSION["创建登录 Session"]
    SESSION --> ROLE{"账号角色"}
    ROLE -->|普通用户| USER["用户工作区"]
    ROLE -->|管理员| ADMIN["管理后台"]

    INSTALL["安装向导 /install"] --> CHECK["检查运行环境与 PostgreSQL"]
    CHECK --> SCHEMA["初始化数据库表结构"]
    SCHEMA --> FIRST_ADMIN["创建首个管理员"]
    FIRST_ADMIN --> ADMIN
```

</details>

<details>
<summary><strong>02｜用户工作区页面导航</strong></summary>

```mermaid
flowchart TB
    USER["用户工作区<br/>加载用户、积分、模型和站点配置"]

    USER --> CREATE["统一 Agent /create"]
    USER --> IMAGE["图片工作台 /image"]
    USER --> VIDEO["视频工作台 /video"]

    USER --> CANVAS["画布项目 /canvas"]
    CANVAS --> CANVAS_ID["画布编辑器 /canvas/:id"]

    USER --> DRAMA["短剧项目 /drama"]
    DRAMA --> DRAMA_ID["短剧编辑器 /drama/:id"]

    USER --> PROMPTS["公共提示词 /prompts"]
    USER --> MY_PROMPTS["我的提示词 /my-prompts"]
    USER --> ASSETS["我的素材 /assets"]
    USER --> HELP["帮助中心 /help"]
    USER --> PROFILE["个人中心 /profile"]
    USER --> BILLING["充值中心 /billing"]

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
<summary><strong>03｜Agent、图片和视频生成流程</strong></summary>

```mermaid
flowchart TB
    START["用户输入文字或参考素材"] --> ENTRY{"选择创作入口"}

    ENTRY -->|统一创作| AGENT["统一 Agent"]
    ENTRY -->|图片生成| IMAGE["图片工作台"]
    ENTRY -->|视频生成| VIDEO["视频工作台"]

    AGENT --> SKILL["选择 Skill、智能规划或逻辑模型"]
    IMAGE --> IMAGE_PARAM["设置参考图、比例、质量和数量"]
    VIDEO --> VIDEO_PARAM["设置参考素材、时长、比例和清晰度"]

    SKILL --> CHECK["能力、素材、参数与积分校验"]
    IMAGE_PARAM --> CHECK
    VIDEO_PARAM --> CHECK

    CHECK --> ROUTER["逻辑模型路由"]
    ROUTER --> CREATE_TASK["创建幂等生成任务"]
    CREATE_TASK --> PROVIDER["调用文本、图片、视频或音频上游"]
    PROVIDER --> POLL["查询同一个上游任务"]
    POLL --> RESULT{"任务结果"}

    RESULT -->|成功| NORMALIZE["下载并规范化媒体"]
    RESULT -->|失败| FAILED["保留失败记录并退款"]
    FAILED --> RETRY["用户主动点击重试"]
    RETRY --> CREATE_TASK

    NORMALIZE --> SAVE["登记媒体归属和稳定地址"]
    SAVE --> MESSAGE["返回当前创作会话"]
    MESSAGE --> OPERATE["预览、下载、保存素材或继续创作"]
```

</details>

<details>
<summary><strong>04｜画布创作流程</strong></summary>

```mermaid
flowchart LR
    LIST["画布项目 /canvas"] --> CREATE["创建画布"]
    LIST --> OPEN["打开项目"]
    CREATE --> EDITOR["画布编辑器 /canvas/:id"]
    OPEN --> EDITOR

    EDITOR --> NODE{"添加节点"}
    NODE --> TEXT["文本"]
    NODE --> IMAGE["图片"]
    NODE --> VIDEO["视频"]
    NODE --> AUDIO["音频"]
    NODE --> GENERATE["生成"]

    TEXT --> CONNECT["拖拽、缩放和连线"]
    IMAGE --> CONNECT
    VIDEO --> CONNECT
    AUDIO --> CONNECT
    GENERATE --> CONNECT

    CONNECT --> AGENT["启动 Canvas Agent Run"]
    AGENT --> PLAN["分析节点与连接"]
    PLAN --> TASK["创建图片 / 视频 / 音频子任务"]
    TASK --> RESULT["结果写回节点"]
    RESULT --> SAVE["自动保存到服务器"]
```

</details>

<details>
<summary><strong>05｜短剧生产流程</strong></summary>

```mermaid
flowchart LR
    LIST["短剧项目 /drama"] --> CREATE["创建项目"]
    CREATE --> CONFIG["设置剧集、画幅与镜头"]
    CONFIG --> EDITOR["短剧编辑器 /drama/:id"]

    EDITOR --> SCRIPT["剧本"]
    SCRIPT --> REVIEW["内容审核与确认"]
    REVIEW --> ASSETS["角色 / 场景 / 道具"]
    ASSETS --> STORYBOARD["分镜与镜头设计"]
    STORYBOARD --> SHOTS["镜头图片与视频"]
    SHOTS --> AUDIO["配音 / 音效 / BGM"]
    AUDIO --> SUBTITLE["字幕生成与校对"]
    SUBTITLE --> VERSION["版本保存"]
    VERSION --> COMPOSE["FFmpeg 合成成片"]
    COMPOSE --> EXPORT["预览与导出"]
```

</details>

<details>
<summary><strong>06｜提示词、素材、账户与支付</strong></summary>

```mermaid
flowchart TB
    PROMPTS["公共提示词 /prompts"] --> USE["用于 Agent / 图片 / 视频"]
    MY["我的提示词 /my-prompts"] --> USE
    ASSETS["我的素材 /assets"] --> CONTINUE["发送到 Agent / 工作台 / 画布 / 短剧"]

    PROFILE["个人中心 /profile"] --> INFO["资料与密码"]
    PROFILE --> RIGHTS["积分、套餐与订单"]
    BILLING["充值中心 /billing"] --> ORDER["创建订单"]
    ORDER --> CHECKOUT["支付 /billing/checkout"]
    CHECKOUT --> GRANT["套餐或积分入账"]
```

</details>

<details>
<summary><strong>07｜管理后台经营与财务</strong></summary>

```mermaid
flowchart TB
    ADMIN["管理后台 /admin"] --> ANALYSIS["经营分析"]
    ADMIN --> PRODUCT["商品运营"]
    ADMIN --> FINANCE["财务管理"]

    ANALYSIS --> OVERVIEW["经营看板"]
    ANALYSIS --> USERS["用户运营"]
    ANALYSIS --> GENERATION["生成运营"]
    PRODUCT --> PRODUCTS["套餐管理"]
    PRODUCT --> ORDERS["订单管理"]
    FINANCE --> POINTS["积分规则"]
    FINANCE --> PAYMENTS["支付渠道"]
    FINANCE --> CDK["CDK"]
    FINANCE --> WALLET["财务流水"]
```

</details>

<details>
<summary><strong>08｜模型、系统、存储与内容</strong></summary>

```mermaid
flowchart TB
    ADMIN["管理后台 /admin"] --> UPSTREAM["上游配置"]
    ADMIN --> SYSTEM["系统管理"]
    ADMIN --> STORAGE["存储与备份"]
    ADMIN --> CONTENT["内容运营"]

    UPSTREAM --> CHANNELS["模型渠道"]
    CHANNELS --> LOGICAL["逻辑模型与默认值"]
    UPSTREAM --> SKILLS["Agent Skills"]
    SYSTEM --> SITE["站点资料"]
    SYSTEM --> SETTINGS["基础设置"]
    STORAGE --> LOCAL["本地媒体"]
    STORAGE --> S3["S3 兼容对象存储"]
    CONTENT --> ANNOUNCEMENT["公告"]
    CONTENT --> PROMPT["提示词库"]
```

</details>

<details>
<summary><strong>09｜服务端数据流程</strong></summary>

```mermaid
flowchart LR
    PAGE["页面"] --> CLIENT["前端 API Service"]
    CLIENT --> ROUTE["Route Handler"]
    ROUTE --> AUTH["Session 与权限"]
    AUTH --> SERVICE["业务服务"]
    SERVICE --> REPO["Repository"]
    REPO --> PG[("PostgreSQL 16")]
    SERVICE --> ROUTER["逻辑模型路由"]
    ROUTER --> PROVIDER["上游模型"]
    PROVIDER --> TASK["幂等任务与轮询"]
    TASK --> BILLING["积分扣费"]
    TASK --> MEDIA["媒体登记"]
    MEDIA --> LOCAL["本地目录"]
    MEDIA --> S3["对象存储"]
    MEDIA --> PG
```

</details>

一条生成任务只调用一次上游创建接口，轮询只查询同一个任务。只有上游明确失败并且用户点击重试，才会创建新的 attempt，避免重复消耗额度。平台规划提示词、模型理由和复盘详情只用于内部执行，不显示或持久化到生成型对话。

完整目录职责、Agent、媒体、计费和部署说明见[项目结构与流程](docs/content/docs/overview/project-structure.mdx)。

## 最低服务器配置

JoveCanvas 调用外部 AI 模型，不要求 GPU。服务器主要承担 Web、PostgreSQL、媒体下载 / 存储和可选 FFmpeg 转码。

| 使用方式 | CPU | 内存 | 磁盘 | 说明 |
| --- | --- | --- | --- | --- |
| 最低可启动 | 1 核 | 1GB + 1GB swap | 10GB SSD | 发布镜像 + 外部 PostgreSQL + 外部对象存储；仅适合安装体验 |
| 标准小型部署 | 2 核 | 2GB + 1GB swap | 20GB SSD | 应用与数据库同机；不要在服务器现场构建镜像 |
| 推荐日常使用 | 2–4 核 | 4GB | 40GB+ SSD | 图片 / 视频工作台、画布、后台与少量并发 |
| 短剧合成或重视频处理 | 4 核以上 | 8GB 以上 | 80GB+ SSD | FFmpeg 与长视频会明显占用 CPU、内存和临时磁盘 |

最低环境还需要：64 位 Linux、Docker 与 Compose v2、PostgreSQL 16、可用域名和 HTTPS、能够访问模型上游的出站网络。源码开发建议至少 2GB 内存，4GB 更稳妥。完整说明见[低内存服务器部署](docs/content/docs/overview/low-memory.mdx)。

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
```

> 说明：运行时环境变量仍以 `VOZEB_PRO_*` 为前缀（与现有代码一致），不影响产品对外品牌 **JoveCanvas**。

生成加密密钥并启动：

```bash
openssl rand -hex 32
docker compose pull
docker compose up -d
docker compose ps
```

打开 `https://你的域名/install`，检查数据库、初始化表结构并创建首个管理员。

### 宝塔 PostgreSQL

```bash
docker compose -f docker-compose.baota.yml up -d
```

```dotenv
VOZEB_PRO_DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://user:password@127.0.0.1:5432/vozeb_pro
VOZEB_PRO_DATABASE_SSL=0
VOZEB_PRO_TRUSTED_PROXY_HOPS=1
```

宝塔 Nginx 反向代理应转发 `Host`、`X-Forwarded-Host`、`X-Forwarded-Proto` 和 `X-Forwarded-For`。详见[生产上线基线](docs/content/docs/overview/production-readiness.mdx)与[Docker 部署](docs/content/docs/overview/docker.mdx)。

### 源码开发

环境要求：Node.js 22、pnpm 10+、PostgreSQL 16；短剧合成和本地转码还需要 FFmpeg。

```bash
cp .env.example web/.env.local
cd web
pnpm install --frozen-lockfile
pnpm run dev
```

访问 `http://localhost:3000/install`（若本地端口配置不同，以实际启动端口为准）。文档站在 `docs/` 中独立运行：

```bash
cd docs
pnpm install --frozen-lockfile
pnpm run dev
```

## 首次配置顺序

1. 在 `/install` 完成数据库初始化和首个管理员创建。
2. 在后台「模型渠道」配置 Base URL、API Key、协议和模型目录。
3. 检测文本、图片、视频和音频能力，创建逻辑模型并设置默认值。
4. 配置套餐、积分规则和可选支付渠道。
5. 配置 SMTP、注册策略、本地媒体或 S3 兼容对象存储。
6. 在「初始化配置」检查上线项，再验证真实生成、退款和备份恢复。

## 项目文件

| 路径 | 内容 |
| --- | --- |
| `web/src/app/` | Next.js 页面、布局、安装页、用户工作区、管理后台与 API Route Handler |
| `web/src/lib/server/` | Agent 编排、模型路由、生成任务、计费、媒体、对象存储、支付与安全 |
| `web/src/lib/server/database/` | PostgreSQL 表结构、参数化 Repository、文件 Provider 回退 |
| `web/src/components/` / `web/src/hooks/` | 跨页面 UI、工作台控制器、素材选择与会话交互 |
| `web/src/services/api/` / `web/src/stores/` | 浏览器访问本站 API 的类型化客户端与瞬时状态 |
| `web/scripts/` | standalone 启动、管理员密码重置、发布前检查、提示词种子导入 |
| `web/public/` | 站点 Logo、浏览器图标与模型品牌图标 |
| `docs/content/docs/` | 功能、安装、部署、数据库与排障文档 |
| `docs/public/screenshots/` | 用户端与管理后台的脱敏功能截图 |
| `.env.example` | 数据库、站点、加密、代理、媒体、模型、支付与部署变量模板 |
| `Dockerfile` / `docker-compose*.yml` | 生产镜像与多种部署拓扑 |
| `VERSION` / `CHANGELOG.md` | 版本号与变更记录 |
| `LICENSE` / `CLA.md` / `SECURITY.md` | AGPL-3.0、贡献者授权与安全策略 |
| `AGENTS.md` / `CONTRIBUTING.md` | 工程约束与贡献流程 |

更完整的目录树与关键入口见[项目结构与流程](docs/content/docs/overview/project-structure.mdx)。

## 页面展示

<table>
  <tr>
    <td width="50%"><img src="docs/public/screenshots/pages/03a-canvas-editor.webp" alt="画布编辑器"></td>
    <td width="50%"><img src="docs/public/screenshots/pages/04a-drama-editor.webp" alt="短剧生产编辑器"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/public/screenshots/pages/05-image-workbench.webp" alt="图片工作台"></td>
    <td width="50%"><img src="docs/public/screenshots/pages/06-video-workbench.webp" alt="视频工作台"></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/public/screenshots/pages/20-admin-overview.webp" alt="经营看板"></td>
    <td width="50%"><img src="docs/public/screenshots/pages/34-admin-channels.webp" alt="模型渠道"></td>
  </tr>
</table>

更多截图见[页面功能图册](docs/content/docs/overview/page-gallery.mdx)。

## 数据与安全

- PostgreSQL 保存用户、会话、设置、创作会话、画布、素材、短剧、生成任务、积分和订单。
- 外部存储关闭时新媒体只写 `VOZEB_PRO_DATA_DIR`；开启时新媒体只写 S3 兼容对象存储。历史媒体按登记 Provider 读取。
- 业务记录保存稳定站内 `storageKey`，不保存 base64、对象 Key 或临时签名 URL。
- `.env`、API Key、支付密钥、数据库、媒体文件、备份、日志和构建产物不得提交 Git。
- 生产备份必须同时覆盖 PostgreSQL 和本地媒体或对象存储。

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

## 文档与协议

- [功能总览](docs/content/docs/overview/features.mdx)
- [项目结构与流程](docs/content/docs/overview/project-structure.mdx)
- [配置说明](docs/content/docs/overview/configuration.mdx)
- [数据库结构](docs/content/docs/backend/backend-database.mdx)
- [待测试](docs/content/docs/progress/pending-test.mdx)
- [参与贡献](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [AGPL-3.0](LICENSE)
- [贡献者协议](CLA.md)
