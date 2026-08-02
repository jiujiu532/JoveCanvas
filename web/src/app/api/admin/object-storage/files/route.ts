import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getPublicUsersByIds } from "@/lib/auth/store";
import { deleteExternalStorageFiles, listExternalStorageFiles } from "@/lib/server/object-storage-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

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
            ownerUserId: params.get("ownerUserId") || undefined,
        });
        const users = await getPublicUsersByIds(data.items.map((item) => item.ownerUserId || ""));
        const userMap = new Map(users.map((user) => [user.id, user]));
        return NextResponse.json(
            {
                code: 0,
                data: {
                    ...data,
                    items: data.items.map((item) => {
                        const owner = item.ownerUserId ? userMap.get(item.ownerUserId) : undefined;
                        return { ...item, ownerAccountId: owner?.accountId, ownerUsername: owner?.username, ownerDisplayName: owner?.displayName };
                    }),
                },
                msg: "OK",
            },
            { headers: { "Cache-Control": "private, no-store" } },
        );
    } catch (error) {
        console.error("Object storage list failed", error);
        return NextResponse.json(
            {
                code: 500,
                data: null,
                msg: error instanceof Error ? await localizeErrorMessage(error) : await serverMessage("media.externalFileLoadFailed"),
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
    }
    if ("keys" in body && !Array.isArray(body.keys)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("admin.keysMustBeStringArray") }, { status: 400 });
    }
    const keys = Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === "string" && key.trim().length > 0) : [];
    if (!keys.length) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("media.selectObjectsToDelete") }, { status: 400 });
    try {
        const data = await deleteExternalStorageFiles(keys);
        return NextResponse.json({
            code: 0,
            data,
            msg: data.blocked.length ? await serverMessage("media.externalObjectsPartialBlocked") : await serverMessage("media.externalObjectsDeleted"),
        });
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
