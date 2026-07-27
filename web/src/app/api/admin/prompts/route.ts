import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { isAuthInputError } from "@/lib/auth/store";
import { readJsonBody } from "@/lib/auth/request";
import { LOCALE_COOKIE_NAME } from "@/i18n/locale";
import { resolvePreferLocale } from "@/lib/prompts/locale-rank";
import { createPrompt, listPrompts, type PromptInput } from "@/lib/prompts/store";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.get("pageSize")) || 20));
    const preferLocale = resolvePreferLocale(params.get("preferLocale"), request.cookies.get(LOCALE_COOKIE_NAME)?.value);
    const result = await listPrompts({
        scope: "library",
        keyword: params.get("keyword") || "",
        tags: params.getAll("tag").filter(Boolean),
        category: params.get("category") || "",
        page,
        pageSize,
        preferLocale,
    });
    return NextResponse.json({
        prompts: result.items,
        total: result.total,
        scopeTotal: result.scopeTotal,
        page,
        pageSize,
        tags: result.tags,
        categories: result.categories,
    });
}

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const body = await readJsonBody<PromptInput>(request);
        const prompt = await createPrompt("library", body);
        return NextResponse.json({ prompt });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Create admin prompt failed", error);
        return NextResponse.json({ error: await serverMessage("prompts.createFailed") }, { status: 500 });
    }
}
