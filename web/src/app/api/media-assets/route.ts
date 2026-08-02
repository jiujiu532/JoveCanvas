import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { deleteUserLocalMediaAssets } from "@/lib/server/local-media-storage";
import { serverMessage } from "@/lib/server/server-messages";

export async function DELETE(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as { storageKeys?: unknown };
    const storageKeys = Array.isArray(body.storageKeys) ? body.storageKeys.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).slice(0, 200) : [];
    if (!storageKeys.length) return NextResponse.json({ code: 0, data: { deletedFiles: 0, deletedBytes: 0, blocked: [] }, msg: await serverMessage("media.nothingToDelete") });
    const result = await deleteUserLocalMediaAssets(user.id, storageKeys);
    return NextResponse.json({
        code: 0,
        data: result,
        msg: result.blocked.length ? await serverMessage("media.partialBlockedKept") : await serverMessage("media.deleted"),
    });
}
