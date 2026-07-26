"use client";

import { Check, Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { MenuProps } from "antd";
import { Dropdown } from "antd";

import { cn } from "@/lib/utils";
import { LOCALE_COOKIE_NAME, type AppLocale } from "@/i18n/locale";

type LocaleSwitcherProps = {
    className?: string;
};

// 语言切换按钮：写 cookie 后刷新当前路由，服务端/客户端字典随之切换
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
    const locale = useLocale() as AppLocale;
    const router = useRouter();
    const t = useTranslations("common");

    const changeLocale = (next: AppLocale) => {
        if (next === locale) return;
        document.cookie = `${LOCALE_COOKIE_NAME}=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
        router.refresh();
    };

    const items: MenuProps["items"] = [
        {
            key: "zh",
            label: (
                <span className="flex min-w-24 items-center justify-between gap-3">
                    {t("languageZh")}
                    {locale === "zh" ? <Check className="size-3.5" /> : null}
                </span>
            ),
        },
        {
            key: "en",
            label: (
                <span className="flex min-w-24 items-center justify-between gap-3">
                    {t("languageEn")}
                    {locale === "en" ? <Check className="size-3.5" /> : null}
                </span>
            ),
        },
    ];

    return (
        <Dropdown menu={{ items, onClick: ({ key }) => changeLocale(key as AppLocale) }} trigger={["click"]} placement="bottomRight">
            <button
                type="button"
                className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e6e9ed] bg-white text-sm font-medium text-[#59616c] transition hover:border-[#d9dde3] hover:bg-[#f3f5f7] hover:text-[#20242a] dark:border-[#2c3138] dark:bg-[#181b20] dark:text-[#b7bec8] dark:hover:border-[#3b424c] dark:hover:bg-[#22262c] dark:hover:text-white",
                    className,
                )}
                aria-label={t("language")}
                title={t("language")}
            >
                <Languages className="size-4" />
            </button>
        </Dropdown>
    );
}
