import { DocPageContent, getDocPageMetadata } from "@/lib/doc-page";
import { normalizeLocale } from "@/lib/i18n";
import { source } from "@/lib/source";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ lang: string; slug?: string[] }>;
}) {
  const params = await props.params;
  const lang = normalizeLocale(params.lang);
  const page = source.getPage(params.slug, lang);
  if (!page) notFound();

  return <DocPageContent page={page} />;
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string; slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLocale(params.lang);
  const page = source.getPage(params.slug, lang);
  if (!page) notFound();

  return getDocPageMetadata(page);
}

export function generateStaticParams() {
  return source.generateParams("slug", "lang");
}
