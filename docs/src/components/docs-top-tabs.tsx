"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { getDictionary } from "@/lib/dictionaries";
import { localePath, normalizeLocale } from "@/lib/i18n";

function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return pathname.slice(3) || "/";
  }
  return pathname;
}

export function DocsTopTabs({ locale }: { locale?: string }) {
  const pathname = usePathname();
  const lang = normalizeLocale(locale);
  const dict = getDictionary(lang);
  const barePath = stripLocalePrefix(pathname);

  return (
    <nav className="sticky top-0 z-30 hidden h-12 self-start overflow-x-auto border-b bg-fd-background/95 px-6 pt-3 backdrop-blur [grid-area:main] md:flex xl:px-8">
      <div className="flex flex-row items-end gap-6">
        {dict.tabs.map((tab) => {
          const href = localePath(lang, tab.href);
          const active =
            barePath === tab.href || barePath.startsWith(`${tab.prefix}/`);

          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "inline-flex border-b-2 border-transparent pb-1.5 text-sm font-medium text-nowrap text-fd-muted-foreground transition-colors hover:text-fd-accent-foreground",
                active && "border-fd-primary text-fd-primary",
              )}
            >
              {tab.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
