import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE_NAME, type AppLocale } from "@/i18n/locale";

// Zustand / 非 React 客户端上下文：从 cookie 同步读取 UI locale，默认中文
export function resolveClientStoreLocale(): AppLocale {
    if (typeof document === "undefined") return DEFAULT_LOCALE;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`));
    const value = match ? decodeURIComponent(match[1]) : undefined;
    return isAppLocale(value) ? value : DEFAULT_LOCALE;
}
