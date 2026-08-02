"use client";

import SearchDialog from "@/components/search";
import { i18n } from "@/lib/i18n";
import { defineI18nUI } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import { type ReactNode } from "react";

const { provider } = defineI18nUI(i18n, {
  zh: {
    displayName: "中文",
    search: "搜索",
    searchNoResult: "未找到结果",
    searchOpen: "打开搜索",
    searchClose: "关闭搜索",
    toc: "本页目录",
    tocNoHeadings: "本页无标题",
    tocInline: "目录",
    lastUpdate: "最后更新于",
    chooseLanguage: "选择语言",
    nextPage: "下一页",
    previousPage: "上一页",
    chooseTheme: "主题",
    editOnGithub: "在 GitHub 上编辑",
    themeToggle: "切换主题",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    codeBlockCopy: "复制文本",
    codeBlockCopied: "已复制",
    menuToggle: "切换菜单",
    sidebarOpen: "打开侧栏",
    sidebarCollapse: "折叠侧栏",
    pageActionsCopyMarkdown: "复制 Markdown",
    pageActionsOpen: "打开",
    pageActionsOpenGitHub: "在 GitHub 中打开",
    pageActionsViewMarkdown: "以 Markdown 查看",
    notFoundTitle: "页面未找到",
    notFoundDescription: "您访问的页面可能已被移除、更名或暂时不可用。",
    notFoundLink: "返回首页",
  },
  en: {
    displayName: "English",
    search: "Search",
    searchNoResult: "No results found",
    searchOpen: "Open search",
    searchClose: "Close search",
    toc: "On this page",
    tocNoHeadings: "No headings",
    tocInline: "Table of contents",
    lastUpdate: "Last updated on",
    chooseLanguage: "Choose a language",
    nextPage: "Next page",
    previousPage: "Previous page",
    chooseTheme: "Theme",
    editOnGithub: "Edit on GitHub",
    themeToggle: "Toggle theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    codeBlockCopy: "Copy text",
    codeBlockCopied: "Copied",
    menuToggle: "Toggle menu",
    sidebarOpen: "Open sidebar",
    sidebarCollapse: "Collapse sidebar",
    pageActionsCopyMarkdown: "Copy Markdown",
    pageActionsOpen: "Open",
    pageActionsOpenGitHub: "Open in GitHub",
    pageActionsViewMarkdown: "View as Markdown",
    notFoundTitle: "Page not found",
    notFoundDescription:
      "The page you are looking for might have been removed, renamed, or is temporarily unavailable.",
    notFoundLink: "Back to home",
  },
});

export function Provider({
  children,
  locale,
}: {
  children: ReactNode;
  locale?: string;
}) {
  return (
    <RootProvider search={{ SearchDialog }} i18n={provider(locale)}>
      {children}
    </RootProvider>
  );
}
