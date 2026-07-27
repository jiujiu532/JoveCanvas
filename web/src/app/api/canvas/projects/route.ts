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
    try {
        const project = await createCanvasProjectForUser(user.id, await request.json().catch(() => ({})));
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
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const deleted = await deleteCanvasProjectsForUser(user.id, body.ids);
    return NextResponse.json({ code: 0, data: { deleted }, msg: await serverMessage("canvas.projectDeleted") });
}
