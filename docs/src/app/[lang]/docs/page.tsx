import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { Markdown } from "fumadocs-core/content/md";
import { getTableOfContents } from "fumadocs-core/content/toc";
import { remarkHeading } from "fumadocs-core/mdx-plugins";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metadata } from "next";
import { getMDXComponents } from "@/components/mdx";
import { getDictionary } from "@/lib/dictionaries";
import { localePath, normalizeLocale } from "@/lib/i18n";

async function readDocsIndex(locale: string) {
  const fileName = locale === "en" ? "index.en.md" : "index.md";
  try {
    return await readFile(join(process.cwd(), fileName), "utf8");
  } catch {
    return readFile(join(process.cwd(), "index.md"), "utf8");
  }
}

export default async function Page(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);
  const dict = getDictionary(lang);
  const content = await readDocsIndex(lang);
  const toc = getTableOfContents(content);

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{dict.docsIndex.title}</DocsTitle>
      <DocsDescription>{dict.docsIndex.description}</DocsDescription>
      <DocsBody>
        <Markdown
          components={getMDXComponents()}
          remarkPlugins={[remarkHeading]}
        >
          {content}
        </Markdown>
      </DocsBody>
    </DocsPage>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);
  const dict = getDictionary(lang);
  const path = localePath(lang, "/docs");

  return {
    title: dict.docsIndex.title,
    description: dict.docsIndex.description,
    alternates: { canonical: path },
    openGraph: {
      url: path,
      title: dict.docsIndex.title,
      description: dict.docsIndex.description,
    },
  };
}
