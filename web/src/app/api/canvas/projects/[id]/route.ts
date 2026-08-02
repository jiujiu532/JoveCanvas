import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canvasProjectError, getCanvasProjectForUser, updateCanvasProjectForUser } from "@/lib/server/canvas-project-service";
import { serverMessage } from "@/lib/server/server-messages";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const project = await getCanvasProjectForUser(user.id, (await context.params).id);
        return NextResponse.json({ code: 0, data: { project }, msg: "OK" });
    } catch (error) {
        const known = canvasProjectError(error);
        if (known) return NextResponse.json({ code: known.status, data: null, msg: known.message }, { status: known.status });
        throw error;
    }
}

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
    }
    if ("title" in body && body.title !== undefined && typeof body.title !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.titleMustBeString") }, { status: 400 });
    }
    if ("nodes" in body && body.nodes !== undefined && !Array.isArray(body.nodes)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.nodesMustBeArray") }, { status: 400 });
    }
    if ("connections" in body && body.connections !== undefined && !Array.isArray(body.connections)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.connectionsMustBeArray") }, { status: 400 });
    }
    if ("chatSessions" in body && body.chatSessions !== undefined && !Array.isArray(body.chatSessions)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.chatSessionsMustBeArray") }, { status: 400 });
    }
    if ("activeChatId" in body && body.activeChatId !== undefined && body.activeChatId !== null && typeof body.activeChatId !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.activeChatIdInvalid") }, { status: 400 });
    }
    if ("backgroundMode" in body && body.backgroundMode !== undefined && body.backgroundMode !== "lines" && body.backgroundMode !== "dots" && body.backgroundMode !== "blank") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.backgroundModeInvalid") }, { status: 400 });
    }
    if ("showImageInfo" in body && body.showImageInfo !== undefined && typeof body.showImageInfo !== "boolean") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.showImageInfoMustBeBoolean") }, { status: 400 });
    }
    if ("viewport" in body && body.viewport !== undefined && (typeof body.viewport !== "object" || body.viewport === null || Array.isArray(body.viewport))) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.viewportMustBeObject") }, { status: 400 });
    }
    if ("updatedAt" in body && body.updatedAt !== undefined && typeof body.updatedAt !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.updatedAtMustBeString") }, { status: 400 });
    }
    try {
        const project = await updateCanvasProjectForUser(user.id, (await context.params).id, body);
        return NextResponse.json({ code: 0, data: { project }, msg: await serverMessage("canvas.projectSaved") });
    } catch (error) {
        const known = canvasProjectError(error);
        if (known) return NextResponse.json({ code: known.status, data: null, msg: known.message }, { status: known.status });
        throw error;
    }
}
