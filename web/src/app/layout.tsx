import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppProviders } from "@/components/layout/app-providers";
import { absoluteSiteUrl, getPublicSiteSettings, siteMetadataBase } from "@/lib/server/site-metadata";
import "antd/dist/reset.css";
import "./globals.css";
import React from "react";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ],
};

export async function generateMetadata(): Promise<Metadata> {
    const site = await getPublicSiteSettings();
    const locale = await getLocale();
    const base = siteMetadataBase();
    const logoUrl = absoluteSiteUrl(site.logoUrl || "/logo.svg", base);
    const iconUrl = absoluteSiteUrl("/favicon.ico", base);
    const title = site.seoTitle || site.title;
    return {
        metadataBase: base,
        title,
        description: site.seoDescription,
        alternates: { canonical: "/" },
        icons: {
            icon: iconUrl,
            shortcut: iconUrl,
            apple: iconUrl,
        },
        keywords: site.seoKeywords
            .split(/[,，]/)
            .map((keyword) => keyword.trim())
            .filter(Boolean),
        openGraph: {
            type: "website",
            title,
            description: site.seoDescription,
            siteName: site.title,
            images: logoUrl ? [{ url: logoUrl }] : undefined,
            locale: locale === "en" ? "en_US" : "zh_CN",
        },
        twitter: {
            card: "summary",
            title,
            description: site.seoDescription,
            images: logoUrl ? [logoUrl] : undefined,
        },
    };
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale === "zh" ? "zh-CN" : "en"} suppressHydrationWarning className="font-sans">
            <head>
                <link rel="icon" href="/favicon.ico" />
                <link rel="shortcut icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" href="/favicon.ico" />
            </head>
            <body
                className="bg-background text-foreground antialiased"
                style={{
                    fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif',
                }}
            >
                <Script
                    id="theme-script"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `try{var s=JSON.parse(localStorage.getItem("vozeb-pro:theme_store")||"{}");var t=s.state&&s.state.theme==="dark"?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark");document.documentElement.style.colorScheme=t}catch(e){}`,
                    }}
                />
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <AntdRegistry>
                        <AppProviders>{children}</AppProviders>
                    </AntdRegistry>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
