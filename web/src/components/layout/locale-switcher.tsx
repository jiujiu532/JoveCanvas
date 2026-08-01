"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { LOCALE_COOKIE_NAME, type AppLocale } from "@/i18n/locale";

type LocaleSwitcherProps = {
    className?: string;
    style?: CSSProperties;
};

// 语言切换：点击即在 zh/en 间切换，写 cookie 后刷新当前路由
export function LocaleSwitcher({ className, style }: LocaleSwitcherProps) {
    const locale = useLocale() as AppLocale;
    const router = useRouter();
    const t = useTranslations("common");

    const toggleLocale = () => {
        const next: AppLocale = locale === "zh" ? "en" : "zh";
        document.cookie = `${LOCALE_COOKIE_NAME}=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
        router.refresh();
    };

    const nextLabel = locale === "zh" ? t("languageEn") : t("languageZh");

    return (
        <button
            type="button"
            onClick={toggleLocale}
            className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e6e9ed] bg-white text-sm font-medium text-[#59616c] transition hover:border-[#d9dde3] hover:bg-[#f3f5f7] hover:text-[#20242a] dark:border-[#2c3138] dark:bg-[#181b20] dark:text-[#b7bec8] dark:hover:border-[#3b424c] dark:hover:bg-[#22262c] dark:hover:text-white",
                className,
            )}
            style={style}
            aria-label={`${t("language")}: ${nextLabel}`}
            title={`${t("language")}: ${nextLabel}`}
        >
            <Languages className="size-4" />
        </button>
    );
}
