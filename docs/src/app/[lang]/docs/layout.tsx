import { DocsTopTabs } from "@/components/docs-top-tabs";
import { baseOptions } from "@/lib/layout.shared";
import { normalizeLocale } from "@/lib/i18n";
import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

export default async function Layout(props: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);

  return (
    <DocsLayout
      {...baseOptions(lang)}
      tree={source.getPageTree(lang)}
      tabs={false}
    >
      <DocsTopTabs locale={lang} />
      {props.children}
    </DocsLayout>
  );
}
