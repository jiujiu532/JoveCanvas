import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { findPublicUserIdsByKeyword, getPublicUsersByIds } from "@/lib/auth/store";
import { cleanupExpiredLocalMediaAssets, deleteLocalMediaAssets, getLocalMediaAssetSummary, listLocalMediaAssets } from "@/lib/server/local-media-storage";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    const params = new URL(request.url).searchParams;
    if (params.get("summaryOnly") === "1") return NextResponse.json({ code: 0, data: { summary: await getLocalMediaAssetSummary() }, msg: "OK" });
    const search = params.get("search") || undefined;
    const ownerUserIds = search ? await findPublicUserIdsByKeyword(search) : [];
    const data = await listLocalMediaAssets({
        page: Number(params.get("page") || 1),
        pageSize: Number(params.get("pageSize") || 20),
        storageClass: params.get("storageClass") || undefined,
        type: params.get("type") || undefined,
        source: params.get("source") || undefined,
        search,
        ownerUserIds,
    });
    const users = await getPublicUsersByIds(data.items.map((item) => item.ownerUserId || ""));
    const userMap = new Map(users.map((user) => [user.id, user]));
    return NextResponse.json({
        code: 0,
        data: {
            ...data,
            items: data.items.map((item) => {
                const owner = item.ownerUserId ? userMap.get(item.ownerUserId) : undefined;
                return { ...item, ownerAccountId: owner?.accountId, ownerUsername: owner?.username, ownerDisplayName: owner?.displayName };
            }),
        },
        msg: "OK",
    });
}

export async function DELETE(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
    }
    if ("expired" in body && typeof body.expired !== "boolean") {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("admin.expiredMustBeBoolean") }, { status: 400 });
    }
    if (body.expired === true) return NextResponse.json({ code: 0, data: await cleanupExpiredLocalMediaAssets(), msg: await serverMessage("media.tempCleaned") });
    if ("ids" in body && !Array.isArray(body.ids)) {
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("admin.idsMustBeArray") }, { status: 400 });
    }
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : [];
    if (!ids.length) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("media.selectToDelete") }, { status: 400 });
    const result = await deleteLocalMediaAssets(ids);
    return NextResponse.json({ code: 0, data: result, msg: result.blocked.length ? "部分文件仍被业务记录引用，未执行删除" : "媒体文件已删除" });
}
