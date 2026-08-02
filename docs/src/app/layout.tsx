import { Provider } from "@/components/provider";
import { HtmlLang } from "@/components/html-lang";
import type { ReactNode } from "react";
import "./global.css";

/**
 * Root layout owns <html>/<body> (Next.js requirement).
 * Locale-specific metadata/Provider live under `app/[lang]`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Provider>
          <HtmlLang />
          {children}
        </Provider>
      </body>
    </html>
  );
}
