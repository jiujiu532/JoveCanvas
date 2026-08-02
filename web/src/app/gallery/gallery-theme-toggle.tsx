"use client";

import { useTranslations } from "next-intl";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useThemeStore } from "@/stores/use-theme-store";

export function GalleryThemeToggle() {
    const t = useTranslations("layout.userStatus");
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const label = theme === "dark" ? t("toLightTheme") : t("toDarkTheme");
    return (
        <AnimatedThemeToggler
            theme={theme}
            onThemeChange={setTheme}
            className={`!inline-flex !size-9 shrink-0 !items-center !justify-center !rounded-md !border-0 !bg-transparent !p-0 !text-muted-foreground transition hover:!bg-transparent hover:!text-foreground focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-ring [&>svg]:!size-5 ${theme === "dark" ? "" : "[&>svg]:translate-x-px"}`}
            aria-label={label}
            title={label}
        />
    );
}
