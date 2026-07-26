import { NextResponse } from "next/server";

import { deleteAnnouncement, isAuthInputError, updateAnnouncement, type PublicAnnouncement } from "@/lib/auth/store";
import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

async function assertAdmin() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });
    return null;
}

export async function PATCH(request: Request, context: RouteContext) {
    const guard = await assertAdmin();
    if (guard) return guard;

    try {
        const { id } = await context.params;
        const body = await readJsonBody<Partial<PublicAnnouncement>>(request);
        const announcement = await updateAnnouncement(id, body);
        return NextResponse.json({ announcement });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Update announcement failed", error);
        return NextResponse.json({ error: "更新公告失败" }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    const guard = await assertAdmin();
    if (guard) return guard;

    try {
        const { id } = await context.params;
        return NextResponse.json(await deleteAnnouncement(id));
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Delete announcement failed", error);
        return NextResponse.json({ error: "删除公告失败" }, { status: 500 });
    }
}
