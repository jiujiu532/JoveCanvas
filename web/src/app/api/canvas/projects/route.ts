import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canvasProjectError, createCanvasProjectForUser, deleteCanvasProjectsForUser, listCanvasProjectsForUser } from "@/lib/server/canvas-project-service";
import { serverMessage } from "@/lib/server/server-messages";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    return NextResponse.json({ code: 0, data: { projects: await listCanvasProjectsForUser(user.id) }, msg: "OK" });
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
    }
    if ("title" in body && body.title !== undefined && typeof body.title !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.titleMustBeString") }, { status: 400 });
    }
    if ("sourceHandoffId" in body && body.sourceHandoffId !== undefined && typeof body.sourceHandoffId !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.sourceHandoffIdMustBeString") }, { status: 400 });
    }
    if ("project" in body && body.project !== undefined && (typeof body.project !== "object" || body.project === null || Array.isArray(body.project))) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.projectMustBeObject") }, { status: 400 });
    }
    try {
        const project = await createCanvasProjectForUser(user.id, body);
        return NextResponse.json({ code: 0, data: { project }, msg: await serverMessage("canvas.projectCreated") });
    } catch (error) {
        const known = canvasProjectError(error);
        if (known) return NextResponse.json({ code: known.status, data: null, msg: known.message }, { status: known.status });
        throw error;
    }
}

export async function DELETE(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
    }
    if (!Array.isArray(body.ids)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.idsMustBeStringArray") }, { status: 400 });
    }
    const ids = body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    if (!ids.length) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("canvas.selectProjectsToDelete") }, { status: 400 });
    }
    const deleted = await deleteCanvasProjectsForUser(user.id, ids);
    return NextResponse.json({ code: 0, data: { deleted }, msg: await serverMessage("canvas.projectDeleted") });
}
