import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { listAdminGenerationOperations } from "@/lib/server/generation-operations-service";

import { serverMessage } from "@/lib/server/server-messages";
export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const data = await listAdminGenerationOperations({
        page: Number(params.get("page") || 1),
        pageSize: Number(params.get("pageSize") || 20),
        type: params.get("type") || undefined,
        status: params.get("status") || undefined,
        surface: params.get("surface") || undefined,
        userId: params.get("userId") || undefined,
        search: params.get("search") || undefined,
    });
    return NextResponse.json({ code: 0, data, msg: "OK" });
}
