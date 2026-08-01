import { isEncryptedSecretValue } from "@/lib/server/secret-crypto";

import { DEFAULT_SITE_SETTINGS } from "./store-foundation";

export function allowedText(value: unknown, allowed: string[], fallback: string) {
    const text = typeof value === "string" ? value.trim() : "";
    return allowed.includes(text) ? text : fallback;
}

export function normalizeSecretText(value: unknown, fallback: string, maxPlainLength: number) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return fallback;
    return text.slice(0, isEncryptedSecretValue(text) ? 4000 : maxPlainLength);
}

export function normalizeText(value: unknown, fallback: string, maxLength: number) {
    const text = typeof value === "string" ? repairKnownMojibakeText(value.trim()) : "";
    return (text || fallback).slice(0, maxLength);
}

export function repairKnownMojibakeText(value: string) {
    if (value.includes("VOZEB PRO") && value.includes("AI") && !value.includes("绘图") && value.includes(",")) return DEFAULT_SITE_SETTINGS.seoKeywords;
    if (value.includes("VOZEB PRO") && value.includes("AI") && !value.includes("工作台")) return DEFAULT_SITE_SETTINGS.seoDescription;
    if (value.includes("2026 VOZEB PRO") && !value.startsWith("©")) return "© 2026 VOZEB PRO. All rights reserved.";
    if (value.startsWith("QQ ") && !value.includes("邮箱")) return "QQ 邮箱";
    return repairUtf8MojibakeText(value);
}

export function repairUtf8MojibakeText(value: string) {
    if (!looksLikeUtf8Mojibake(value)) return value;
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    if (!repaired || repaired.includes("\uFFFD")) return value;
    return textQualityScore(repaired) > textQualityScore(value) ? repaired : value;
}

export function looksLikeUtf8Mojibake(value: string) {
    if (!value) return false;
    if (/[\u0080-\u009f]/.test(value)) return true;
    if (/[ÂÃ][\u0080-\u00ff]/.test(value)) return true;
    const markers = value.match(/[åæçèéäöüï½ð]/g)?.length || 0;
    return markers >= 2 && !/[\u4e00-\u9fff]/.test(value);
}

export function textQualityScore(value: string) {
    const cjk = value.match(/[\u4e00-\u9fff]/g)?.length || 0;
    const controls = value.match(/[\u0080-\u009f]/g)?.length || 0;
    const replacements = value.match(/\uFFFD/g)?.length || 0;
    const mojibakeMarkers = value.match(/[ÂÃåæçèéäöüï½ð]/g)?.length || 0;
    return cjk * 4 - controls * 6 - replacements * 20 - mojibakeMarkers;
}

export function normalizeOptionalIsoDate(value: unknown) {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return undefined;
    return new Date(time).toISOString();
}

export function normalizeOptionalText(value: unknown, maxLength: number) {
    const text = normalizeText(value, "", maxLength);
    return text || undefined;
}

export function normalizeDate(value: unknown) {
    const text = typeof value === "string" ? value.trim().slice(0, 10) : "";
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : "";
}

export function normalizePoints(value: unknown, fallback: number) {
    return normalizePointAmount(value, fallback);
}

export function normalizePointAmount(value: unknown, fallback: number) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.min(Number(numberValue.toFixed(2)), 1_000_000);
}

export function normalizePointMultiplier(value: unknown, fallback = 1) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) return fallback;
    return Math.min(Number(numberValue.toFixed(2)), 1_000_000);
}

export function normalizePlanId(value: unknown) {
    const id =
        typeof value === "string"
            ? value
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9_.-]/g, "-")
            : "";
    return id.slice(0, 40);
}

export function normalizeLogoUrl(value: unknown) {
    return normalizeSiteImageUrl(value, DEFAULT_SITE_SETTINGS.logoUrl);
}

export function normalizeSiteIconUrl(value: unknown) {
    return normalizeSiteImageUrl(value, DEFAULT_SITE_SETTINGS.iconUrl);
}

function normalizeSiteImageUrl(value: unknown, fallback: string) {
    const url = typeof value === "string" ? value.trim() : "";
    if (!url) return fallback;
    if (url.startsWith("data:image/")) return url.slice(0, 500000);
    if (url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://")) return url.slice(0, 2000);
    return fallback;
}

export function normalizeLinkUrl(value: unknown, fallback: string) {
    const url = typeof value === "string" ? value.trim() : "";
    if (!url) return fallback;
    if (url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://") || url.startsWith("mailto:")) return url.slice(0, 2000);
    return fallback;
}
