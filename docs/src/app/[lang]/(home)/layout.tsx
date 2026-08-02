import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { normalizeLocale } from "@/lib/i18n";
import type { ReactNode } from "react";

export default async function Layout(props: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);
  return <HomeLayout {...baseOptions(lang)}>{props.children}</HomeLayout>;
}
