import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createDramaProjectVersionForUser, DramaProjectServiceError, listDramaProjectVersionsForUser } from "@/lib/server/drama-project-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
    return handle(context, (userId, id) => listDramaProjectVersionsForUser(userId, id).then((versions) => NextResponse.json({ code: 0, data: { versions }, msg: "OK" })));
}

export async function POST(request: Request, context: Context) {
    const body = await request.json().catch(() => ({}));
    return handle(context, async (userId, id) => {
        const version = await createDramaProjectVersionForUser(userId, id, body);
        return NextResponse.json({ code: 0, data: { version }, msg: await serverMessage("drama.versionSaved") });
    });
}

async function handle(context: Context, action: (userId: string, id: string) => Promise<NextResponse>) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        return await action(user.id, (await context.params).id);
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
        throw error;
    }
}
