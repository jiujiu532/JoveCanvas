import type { MetadataRoute } from "next";

import { i18n } from "@/lib/i18n";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://docs.jovecanvas.com"
  ).replace(/\/+$/, "");

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of i18n.languages) {
    const home =
      lang === i18n.defaultLanguage ? `${baseUrl}/` : `${baseUrl}/${lang}`;
    entries.push({
      url: home,
      changeFrequency: "weekly",
      priority: 1,
    });

    for (const page of source.getPages(lang)) {
      entries.push({
        url: `${baseUrl}${page.url}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  return entries;
}
