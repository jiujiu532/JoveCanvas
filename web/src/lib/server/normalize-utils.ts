import { normalizePaymentProvider } from "@/lib/payment-provider";
import type { JsonValue } from "@/lib/server/database";

/**
 * Shared value normalizers for server-side services.
 * Prefer these over local copies when signatures match.
 */

export function normalizeText(value: unknown, fallback: string, maxLength: number) {
    const text = typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
    return (text || fallback).slice(0, maxLength);
}

export function normalizeProvider(value: unknown) {
    return normalizePaymentProvider(value);
}

export function stringValue(value: unknown) {
    return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

export function optionalString(value: unknown) {
    const text = stringValue(value);
    return text || undefined;
}

export function numberValue(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

export function optionalNumber(value: unknown) {
    if (value === null || value === undefined) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

export function jsonValue(value: unknown): JsonValue {
    if (value === null || value === undefined) return {};
    return value as JsonValue;
}

export function optionalJson(value: unknown): JsonValue | undefined {
    if (value === null || value === undefined) return undefined;
    return value as JsonValue;
}

export function isoValue(value: unknown) {
    const date = value instanceof Date ? value : new Date(stringValue(value));
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export function optionalIso(value: unknown) {
    if (!value) return undefined;
    return isoValue(value);
}
