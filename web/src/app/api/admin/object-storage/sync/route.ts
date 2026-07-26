import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { migrateLocalMediaToObjectStorage } from "@/lib/server/object-storage-service";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
    try {
        const data = await migrateLocalMediaToObjectStorage(Number(body.limit) || 20);
        return NextResponse.json({ code: 0, data, msg: data.remaining ? "本批迁移完成，可继续迁移剩余文件" : "本地媒体迁移完成" });
    } catch (error) {
        console.error("Local media migration failed", error);
        return NextResponse.json({ code: 500, data: null, msg: error instanceof Error ? error.message : "本地媒体迁移失败" }, { status: 500 });
    }
}
