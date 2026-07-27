import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { deleteExternalStorageFiles, listExternalStorageFiles } from "@/lib/server/object-storage-service";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const params = new URL(request.url).searchParams;
        const data = await listExternalStorageFiles({
            prefix: params.get("prefix") || undefined,
            cursor: params.get("cursor") || undefined,
            limit: Number(params.get("limit") || 30),
            type: params.get("type") || undefined,
            source: params.get("source") || undefined,
        });
        return NextResponse.json({ code: 0, data, msg: "OK" }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Object storage list failed", error);
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : await serverMessage("media.externalFileLoadFailed") }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
    const keys = Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === "string") : [];
    if (!keys.length) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("media.selectObjectsToDelete") }, { status: 400 });
    try {
        const data = await deleteExternalStorageFiles(keys);
        return NextResponse.json({ code: 0, data, msg: data.blocked.length ? "部分对象仍被业务记录引用，未执行删除" : "外部存储对象已删除" });
    } catch (error) {
        console.error("Object storage delete failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("media.externalObjectDeleteFailed") }, { status: 500 });
    }
}

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    return user.role === "admin" ? null : NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
}
