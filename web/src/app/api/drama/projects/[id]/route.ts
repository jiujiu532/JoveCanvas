import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { deleteDramaProjectForUser, DramaProjectServiceError, getDramaProjectForUser, updateDramaProjectForUser } from "@/lib/server/drama-project-service";

import { serverMessage } from "@/lib/server/server-messages";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
    return handle(context, (userId, id) => getDramaProjectForUser(userId, id).then((project) => NextResponse.json({ code: 0, data: { project }, msg: "OK" })));
}

export async function PATCH(request: Request, context: Context) {
    const body = await request.json().catch(() => ({}));
    return handle(context, async (userId, id) => {
        const project = await updateDramaProjectForUser(userId, id, body);
        return NextResponse.json({ code: 0, data: { project }, msg: await serverMessage("drama.projectSaved") });
    });
}

export async function DELETE(_: Request, context: Context) {
    return handle(context, async (userId, id) => {
        await deleteDramaProjectForUser(userId, id);
        return NextResponse.json({ code: 0, data: { deleted: true }, msg: await serverMessage("drama.projectDeleted") });
    });
}

async function handle(context: Context, action: (userId: string, id: string) => Promise<NextResponse>) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        return await action(user.id, (await context.params).id);
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
