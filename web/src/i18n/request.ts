import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE_NAME } from "@/i18n/locale";

// 无路由前缀模式：语言偏好只存在 cookie 里，不引入 /en 路由段
// 字典按 namespace 拆分为独立文件（messages/{locale}/{namespace}.json），并行维护互不冲突
const NAMESPACES = ["common", "layout", "public", "workspace", "canvas", "drama", "admin", "server"] as const;

export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    const locale = isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

    const entries = await Promise.all(NAMESPACES.map(async (namespace) => [namespace, (await import(`../../messages/${locale}/${namespace}.json`)).default] as const));

    return {
        locale,
        messages: Object.fromEntries(entries),
    };
});
