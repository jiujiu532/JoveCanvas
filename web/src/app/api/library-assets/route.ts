import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createLibraryAssetForUser, LibraryAssetServiceError, listLibraryAssetPageForUser, listLibraryAssetsForUser } from "@/lib/server/library-asset-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const params = new URL(request.url).searchParams;
    if (!params.has("page") && !params.has("pageSize") && !params.has("kind") && !params.has("keyword")) {
        return NextResponse.json({ code: 0, data: { assets: await listLibraryAssetsForUser(user.id) }, msg: "OK" });
    }
    const page = await listLibraryAssetPageForUser(user.id, {
        page: params.get("page"),
        pageSize: params.get("pageSize"),
        kind: params.get("kind"),
        keyword: params.get("keyword"),
    });
    return NextResponse.json({ code: 0, data: { assets: page.items, total: page.total, page: page.page, pageSize: page.pageSize }, msg: "OK" });
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const asset = await createLibraryAssetForUser(user.id, await request.json().catch(() => ({})));
        return NextResponse.json({ code: 0, data: { asset }, msg: await serverMessage("media.assetSaved") });
    } catch (error) {
        return serviceError(error);
    }
}

async function serviceError(error: unknown) {
    if (error instanceof LibraryAssetServiceError) return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
    throw error;
}
