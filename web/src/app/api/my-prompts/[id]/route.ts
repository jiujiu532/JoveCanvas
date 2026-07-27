import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { isAuthInputError } from "@/lib/auth/store";
import { readJsonBody } from "@/lib/auth/request";
import { deletePrompt, updatePrompt, type PromptInput } from "@/lib/prompts/store";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const { id } = await context.params;
        const body = await readJsonBody<PromptInput>(request);
        const prompt = await updatePrompt(id, body, { scope: "user", ownerUserId: currentUser.id });
        return NextResponse.json({ prompt });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Update user prompt failed", error);
        return NextResponse.json({ error: await serverMessage("prompts.updateFailed") }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const { id } = await context.params;
        await deletePrompt(id, { scope: "user", ownerUserId: currentUser.id });
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Delete user prompt failed", error);
        return NextResponse.json({ error: await serverMessage("prompts.deleteFailed") }, { status: 500 });
    }
}
