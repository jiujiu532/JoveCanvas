import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { deleteLibraryAssetForUser, LibraryAssetServiceError, updateLibraryAssetForUser } from "@/lib/server/library-asset-service";

import { serverMessage } from "@/lib/server/server-messages";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const asset = await updateLibraryAssetForUser(user.id, (await context.params).id, await request.json().catch(() => ({})));
        return NextResponse.json({ code: 0, data: { asset }, msg: await serverMessage("media.assetUpdated") });
    } catch (error) {
        return serviceError(error);
    }
}

export async function DELETE(_request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        await deleteLibraryAssetForUser(user.id, (await context.params).id);
        return NextResponse.json({ code: 0, data: { deleted: true }, msg: await serverMessage("media.assetDeleted") });
    } catch (error) {
        return serviceError(error);
    }
}

function serviceError(error: unknown) {
    if (error instanceof LibraryAssetServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
    throw error;
}
