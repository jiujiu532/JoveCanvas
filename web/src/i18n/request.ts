import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE_NAME } from "@/i18n/locale";

// 无路由前缀模式：语言偏好只存在 cookie 里，不引入 /en 路由段
export default getRequestConfig(async () => {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    const locale = isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
    };
});
