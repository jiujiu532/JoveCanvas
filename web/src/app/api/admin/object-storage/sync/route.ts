import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { migrateLocalMediaToObjectStorage } from "@/lib/server/object-storage-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
    }
    let limit = 20;
    if ("limit" in body && body.limit !== undefined && body.limit !== null) {
        if (typeof body.limit !== "number" || !Number.isFinite(body.limit) || !Number.isInteger(body.limit) || body.limit <= 0) {
            return NextResponse.json({ code: 400, data: null, msg: await serverMessage("admin.limitMustBePositiveInt") }, { status: 400 });
        }
        limit = Math.min(body.limit, 500);
    }
    try {
        const data = await migrateLocalMediaToObjectStorage(limit);
        return NextResponse.json({
            code: 0,
            data,
            msg: data.remaining ? await serverMessage("media.localMigrateBatchDone") : await serverMessage("media.localMigrateDone"),
        });
    } catch (error) {
        console.error("Local media migration failed", error);
        return NextResponse.json(
            {
                code: 500,
                data: null,
                msg: error instanceof Error ? await localizeErrorMessage(error) : await serverMessage("media.localMigrateFailed"),
            },
            { status: 500 },
        );
    }
}
