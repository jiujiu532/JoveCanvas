import { createTranslator } from "next-intl";

import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE_NAME } from "@/i18n/locale";
import enDrama from "../../../../../messages/en/drama.json";
import zhDrama from "../../../../../messages/zh/drama.json";

// 供 zustand store、纯工具函数等无法使用 React Hook 的上下文调用：
// 直接从 cookie 读取当前语言并返回一个同步可用的 drama 命名空间翻译器
function currentLocale() {
    if (typeof document === "undefined") return DEFAULT_LOCALE;
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]+)`));
    const value = match ? decodeURIComponent(match[1]) : undefined;
    return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

export function dramaT() {
    const locale = currentLocale();
    const messages = locale === "en" ? enDrama : zhDrama;
    return createTranslator({ locale, messages: { drama: messages }, namespace: "drama" });
}
