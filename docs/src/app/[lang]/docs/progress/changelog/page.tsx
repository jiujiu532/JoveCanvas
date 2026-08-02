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

async function readChangelog() {
  return readFile(join(process.cwd(), "..", "CHANGELOG.md"), "utf8");
}

export default async function ChangelogPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);
  const dict = getDictionary(lang);
  const changelog = await readChangelog();
  const toc = getTableOfContents(changelog);

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{dict.changelog.title}</DocsTitle>
      <DocsDescription>{dict.changelog.description}</DocsDescription>
      <DocsBody>
        <Markdown
          components={getMDXComponents()}
          remarkPlugins={[remarkHeading]}
        >
          {changelog}
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
  const path = localePath(lang, "/docs/progress/changelog");

  return {
    title: dict.changelog.title,
    description: dict.changelog.description,
    alternates: { canonical: path },
    openGraph: {
      url: path,
      title: dict.changelog.title,
      description: dict.changelog.description,
    },
  };
}
