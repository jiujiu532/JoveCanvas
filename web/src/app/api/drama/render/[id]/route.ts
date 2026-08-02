import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDramaRenderTask, transitionDramaRenderTask } from "@/lib/server/drama-render-store";
import { serverMessage } from "@/lib/server/server-messages";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    const task = user ? await getDramaRenderTask((await params).id) : null;
    if (!user || !task || (task.userId !== user.id && user.role !== "admin")) return NextResponse.json({ code: user ? 404 : 401, data: null, msg: await serverMessage("tasks.composeNotFound") }, { status: user ? 404 : 401 });
    return NextResponse.json({ code: 0, data: { id: task.id, status: task.status, result: task.result, error: task.error }, msg: "OK" });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    const task = user ? await getDramaRenderTask((await params).id) : null;
    if (!user || !task || (task.userId !== user.id && user.role !== "admin")) return NextResponse.json({ code: user ? 404 : 401, data: null, msg: await serverMessage("tasks.composeNotFound") }, { status: user ? 404 : 401 });
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    if (body.status !== "cancelled" || !["pending", "running"].includes(task.status)) return NextResponse.json({ code: 409, data: null, msg: await serverMessage("tasks.cannotCancel") }, { status: 409 });
    const next = await transitionDramaRenderTask(task, ["pending", "running"], { status: "cancelled", error: await serverMessage("tasks.cancelled") });
    if (!next) return NextResponse.json({ code: 409, data: null, msg: await serverMessage("tasks.cannotCancel") }, { status: 409 });
    return NextResponse.json({ code: 0, data: next, msg: await serverMessage("common.cancelled") });
}
