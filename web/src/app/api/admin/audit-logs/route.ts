import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { listAuditLogs } from "@/lib/server/audit-log-store";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    const params = request.nextUrl.searchParams;
    const result = await listAuditLogs({
        page: Number(params.get("page")) || 1,
        pageSize: Number(params.get("pageSize")) || 20,
        keyword: params.get("keyword") || "",
        action: params.get("action") || "",
        status: params.get("status") || "",
        actorId: params.get("actorId") || "",
        targetType: params.get("targetType") || "",
        start: params.get("start") || "",
        end: params.get("end") || "",
    });

    return NextResponse.json({ logs: result.items, total: result.total, page: result.page, pageSize: result.pageSize });
}
