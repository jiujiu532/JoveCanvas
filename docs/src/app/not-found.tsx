import type { Metadata } from "next";
import Link from "next/link";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { getDictionary } from "@/lib/dictionaries";
import { localePath } from "@/lib/i18n";

export default function NotFound() {
  // not-found is outside [lang]; default to Chinese shell copy
  const dict = getDictionary("zh");

  return (
    <HomeLayout {...baseOptions("zh")}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-6xl font-bold text-fd-foreground">
          {dict.notFound.title}
        </h1>
        <p className="mt-4 text-xl text-fd-muted-foreground">
          {dict.notFound.heading}
        </p>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          {dict.notFound.description}
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href={localePath("zh", "/")}
            className="rounded-lg bg-fd-primary px-6 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            {dict.notFound.backHome}
          </Link>
          <Link
            href={localePath("zh", "/docs")}
            className="rounded-lg border border-fd-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            {dict.notFound.viewDocs}
          </Link>
        </div>
      </div>
    </HomeLayout>
  );
}

export const metadata: Metadata = {
  title: "404 - 页面未找到 / Page not found",
  description: "您访问的页面不存在 / The page you requested does not exist",
};
