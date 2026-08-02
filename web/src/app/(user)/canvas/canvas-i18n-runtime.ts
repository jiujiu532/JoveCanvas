import { createTranslator } from "next-intl";

import { resolveClientStoreLocale } from "@/lib/client-store-locale";
import enCanvas from "../../../../messages/en/canvas.json";
import zhCanvas from "../../../../messages/zh/canvas.json";

// 供 zustand store、纯工具函数等无法使用 React Hook 的上下文调用
export function canvasT() {
    const locale = resolveClientStoreLocale();
    const messages = locale === "en" ? enCanvas : zhCanvas;
    return createTranslator({ locale, messages: { canvas: messages }, namespace: "canvas" });
}
