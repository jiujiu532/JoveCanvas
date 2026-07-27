import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { canvasProjectError, updateCanvasProjectForUser } from "@/lib/server/canvas-project-service";

import { serverMessage } from "@/lib/server/server-messages";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const project = await updateCanvasProjectForUser(user.id, (await context.params).id, await request.json().catch(() => ({})));
        return NextResponse.json({ code: 0, data: { project }, msg: await serverMessage("canvas.projectSaved") });
    } catch (error) {
        const known = canvasProjectError(error);
        if (known) return NextResponse.json({ code: known.status, data: null, msg: known.message }, { status: known.status });
        throw error;
    }
}
