import type { AppLocale } from "./i18n";

export type ShellDictionary = {
  meta: {
    titleDefault: string;
    titleTemplate: string;
    description: string;
    keywords: string[];
    siteName: string;
    ogDescription: string;
  };
  home: {
    badge: string;
    docsCenter: string;
    intro: string;
    quickStart: string;
    projectRepo: string;
    showcase: string;
    features: string;
    contributors: string;
    contributorsHint: string;
    contributorsAlt: string;
    previewAlt: string;
    previewImages: Array<{ src: string; title: string }>;
  };
  nav: {
    docsNav: string;
    projectRepo: string;
    qqGroup: string;
    qqGroupLabel: string;
  };
  tabs: Array<{ title: string; href: string; prefix: string }>;
  docsIndex: {
    title: string;
    description: string;
  };
  changelog: {
    title: string;
    description: string;
  };
  notFound: {
    title: string;
    heading: string;
    description: string;
    backHome: string;
    viewDocs: string;
    metaTitle: string;
    metaDescription: string;
  };
  search: {
    placeholder: string;
  };
};

const previewImagesZh: ShellDictionary["home"]["previewImages"] = [
  { src: "/screenshots/pages/02-create.webp", title: "Agent 工作台" },
  { src: "/screenshots/pages/03a-canvas-editor.webp", title: "画布编排" },
  { src: "/screenshots/pages/05-image-workbench.webp", title: "图片生成" },
  { src: "/screenshots/pages/06-video-workbench.webp", title: "视频生成" },
];

const previewImagesEn: ShellDictionary["home"]["previewImages"] = [
  { src: "/screenshots/pages/02-create.webp", title: "Agent workbench" },
  { src: "/screenshots/pages/03a-canvas-editor.webp", title: "Canvas editor" },
  { src: "/screenshots/pages/05-image-workbench.webp", title: "Image generation" },
  { src: "/screenshots/pages/06-video-workbench.webp", title: "Video generation" },
];

const zh: ShellDictionary = {
  meta: {
    titleDefault: "JoveCanvas 文档",
    titleTemplate: "%s | JoveCanvas 文档",
    description:
      "JoveCanvas - AI创意工作台官方文档，提供图片、视频、音频、短剧等多种AI生成能力的完整指南。",
    keywords: [
      "JoveCanvas",
      "AI创意",
      "图片生成",
      "视频生成",
      "短剧制作",
      "AI工作台",
      "文档",
    ],
    siteName: "JoveCanvas 文档",
    ogDescription: "JoveCanvas - AI创意工作台官方文档",
  },
  home: {
    badge: "开源 AI 多媒体创作工作台",
    docsCenter: "文档中心",
    intro:
      "JoveCanvas 把 Agent、图片与视频生成、Canvas、短剧、素材沉淀和商业运营放在同一套服务端工作流里。",
    quickStart: "快速开始",
    projectRepo: "项目仓库",
    showcase: "效果展示",
    features: "功能介绍",
    contributors: "开发贡献者",
    contributorsHint: "感谢所有为本项目做出贡献的开发者",
    contributorsAlt: "开发贡献者头像",
    previewAlt: "JoveCanvas 效果图",
    previewImages: previewImagesZh,
  },
  nav: {
    docsNav: "文档导航",
    projectRepo: "项目仓库",
    qqGroup: "JoveCanvas 开源交流 QQ 群",
    qqGroupLabel: "JoveCanvas 开源交流 QQ 群（1049777515）",
  },
  tabs: [
    {
      title: "项目介绍",
      href: "/docs/overview/quick-start",
      prefix: "/docs/overview",
    },
    {
      title: "操作手册",
      href: "/docs/canvas/canvas-node-manual",
      prefix: "/docs/canvas",
    },
    {
      title: "开发文档",
      href: "/docs/backend/local-development",
      prefix: "/docs/backend",
    },
    {
      title: "项目进度",
      href: "/docs/progress/changelog",
      prefix: "/docs/progress",
    },
    {
      title: "商务合作",
      href: "/docs/business/business",
      prefix: "/docs/business",
    },
    {
      title: "赞助支持",
      href: "/docs/support/donate",
      prefix: "/docs/support",
    },
  ],
  docsIndex: {
    title: "JoveCanvas 文档",
    description: "功能说明、操作手册、部署方式、开发文档、商务合作与赞助支持",
  },
  changelog: {
    title: "更新日志",
    description: "项目版本变更记录",
  },
  notFound: {
    title: "404",
    heading: "页面未找到",
    description: "抱歉，您访问的页面不存在或已被移除。",
    backHome: "返回首页",
    viewDocs: "查看文档",
    metaTitle: "404 - 页面未找到",
    metaDescription: "您访问的页面不存在",
  },
  search: {
    placeholder: "搜索文档…",
  },
};

const en: ShellDictionary = {
  meta: {
    titleDefault: "JoveCanvas Docs",
    titleTemplate: "%s | JoveCanvas Docs",
    description:
      "Official documentation for JoveCanvas — an open-source AI creation workspace for images, video, audio, short drama, canvas, and operations.",
    keywords: [
      "JoveCanvas",
      "AI workspace",
      "image generation",
      "video generation",
      "short drama",
      "AI canvas",
      "documentation",
    ],
    siteName: "JoveCanvas Docs",
    ogDescription: "Official documentation for the JoveCanvas AI creation workspace",
  },
  home: {
    badge: "Open-source AI multimedia creation workspace",
    docsCenter: "Documentation",
    intro:
      "JoveCanvas brings Agent chat, image and video generation, Canvas, short drama, asset library, and commercial operations into one server-side workflow.",
    quickStart: "Quick start",
    projectRepo: "Repository",
    showcase: "Product screenshots",
    features: "Features",
    contributors: "Contributors",
    contributorsHint: "Thanks to everyone who has contributed to this project",
    contributorsAlt: "Contributor avatars",
    previewAlt: "JoveCanvas product screenshot",
    previewImages: previewImagesEn,
  },
  nav: {
    docsNav: "Docs",
    projectRepo: "Repository",
    qqGroup: "JoveCanvas community QQ group",
    qqGroupLabel: "JoveCanvas community QQ group (1049777515)",
  },
  tabs: [
    {
      title: "Overview",
      href: "/docs/overview/quick-start",
      prefix: "/docs/overview",
    },
    {
      title: "User guide",
      href: "/docs/canvas/canvas-node-manual",
      prefix: "/docs/canvas",
    },
    {
      title: "Development",
      href: "/docs/backend/local-development",
      prefix: "/docs/backend",
    },
    {
      title: "Progress",
      href: "/docs/progress/changelog",
      prefix: "/docs/progress",
    },
    {
      title: "Business",
      href: "/docs/business/business",
      prefix: "/docs/business",
    },
    {
      title: "Support",
      href: "/docs/support/donate",
      prefix: "/docs/support",
    },
  ],
  docsIndex: {
    title: "JoveCanvas Docs",
    description:
      "Features, operator manuals, deployment, development, business, and sponsorship",
  },
  changelog: {
    title: "Changelog",
    description: "Project version history",
  },
  notFound: {
    title: "404",
    heading: "Page not found",
    description: "Sorry, the page you requested does not exist or has been removed.",
    backHome: "Back to home",
    viewDocs: "View docs",
    metaTitle: "404 - Page not found",
    metaDescription: "The page you requested does not exist",
  },
  search: {
    placeholder: "Search docs…",
  },
};

const dictionaries: Record<AppLocale, ShellDictionary> = { zh, en };

export function getDictionary(locale: string | undefined | null): ShellDictionary {
  if (locale === "en") return en;
  return zh;
}

export { dictionaries };
