import { createHash } from "node:crypto";

/** Normalize prompt text for stable primary hash. */
export function normalizePrompt(prompt: string): string {
    let text = (prompt || "").normalize("NFKC").trim();
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    text = text.replace(/[ \t\f\v]+/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    // Latin lower only — keep CJK as-is.
    text = text.replace(/[A-Z]/g, (ch) => ch.toLowerCase());
    text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();

    const maybeJson = tryStableJson(text);
    if (maybeJson) text = maybeJson;

    return text;
}

function tryStableJson(text: string): string | null {
    if (!text.startsWith("{") && !text.startsWith("[")) return null;
    try {
        const parsed = JSON.parse(text) as unknown;
        return normalizePrompt(JSON.stringify(sortKeys(parsed)));
    } catch {
        return null;
    }
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
        return Object.fromEntries(entries.map(([key, nested]) => [key, sortKeys(nested)]));
    }
    return value;
}

export function promptContentHash(prompt: string): string {
    return createHash("sha256").update(normalizePrompt(prompt), "utf8").digest("hex");
}

/** Normalize cover origin URL for secondary dedup. */
export function normalizeCoverUrl(url: string): string {
    const raw = (url || "").trim();
    if (!raw) return "";
    try {
        const parsed = new URL(raw);
        parsed.hash = "";
        for (const key of [...parsed.searchParams.keys()]) {
            if (/^utm_/i.test(key) || key === "fbclid" || key === "gclid") parsed.searchParams.delete(key);
        }
        parsed.hostname = parsed.hostname.toLowerCase();
        // Drop trailing slash on pathname except root.
        if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
            parsed.pathname = parsed.pathname.replace(/\/+$/, "");
        }
        return parsed.toString();
    } catch {
        return raw.toLowerCase();
    }
}

export function softTitleKey(title: string): string {
    return (title || "")
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
