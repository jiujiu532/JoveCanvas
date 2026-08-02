"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Keep <html lang> in sync with the active URL locale. */
export function HtmlLang() {
  const pathname = usePathname();

  useEffect(() => {
    const isEn = pathname === "/en" || pathname.startsWith("/en/");
    document.documentElement.lang = isEn ? "en" : "zh-CN";
  }, [pathname]);

  return null;
}
