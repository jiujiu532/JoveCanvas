// 全站语言常量：供服务端 request config 与客户端语言切换组件共用
export const SUPPORTED_LOCALES = ["zh", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "zh";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
    return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
