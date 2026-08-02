import { getDictionary } from "@/lib/dictionaries";
import { i18n, normalizeLocale } from "@/lib/i18n";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Provider } from "@/components/provider";

export async function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);
  const dict = getDictionary(lang);
  const ogLocale = lang === "en" ? "en_US" : "zh_CN";

  return {
    title: {
      default: dict.meta.titleDefault,
      template: dict.meta.titleTemplate,
    },
    description: dict.meta.description,
    keywords: dict.meta.keywords,
    authors: [{ name: "JoveCanvas Team" }],
    creator: "JoveCanvas Team",
    publisher: "JoveCanvas",
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://docs.jovecanvas.com",
    ),
    alternates: {
      canonical: lang === "zh" ? "/" : `/${lang}`,
      languages: {
        zh: "/",
        en: "/en",
      },
    },
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
      apple: "/favicon.ico",
    },
    openGraph: {
      type: "website",
      locale: ogLocale,
      url: lang === "zh" ? "/" : `/${lang}`,
      title: dict.meta.titleDefault,
      description: dict.meta.ogDescription,
      siteName: dict.meta.siteName,
      images: ["/logo.svg"],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.titleDefault,
      description: dict.meta.ogDescription,
      images: ["/logo.svg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function LangLayout(props: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang: raw } = await props.params;
  const lang = normalizeLocale(raw);

  // Nested Provider overrides root default with locale-aware UI strings.
  return <Provider locale={lang}>{props.children}</Provider>;
}
