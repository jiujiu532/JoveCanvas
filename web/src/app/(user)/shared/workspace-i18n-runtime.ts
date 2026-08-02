import { createTranslator } from "next-intl";

import { resolveClientStoreLocale } from "@/lib/client-store-locale";
import enWorkspace from "../../../../messages/en/workspace.json";
import zhWorkspace from "../../../../messages/zh/workspace.json";

// 供图片/视频工作台非 React 模块同步读取 workspace 字典
export function workspaceT() {
    const locale = resolveClientStoreLocale();
    const messages = locale === "en" ? enWorkspace : zhWorkspace;
    return createTranslator({ locale, messages: { workspace: messages }, namespace: "workspace" });
}
