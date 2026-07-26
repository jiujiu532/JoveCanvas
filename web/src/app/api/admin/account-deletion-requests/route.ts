import { NextResponse } from "next/server";

import { ACCOUNT_DELETION_REQUEST_STATUSES, type AccountDeletionRequestStatus } from "@/lib/account-deletion-contract";
import { getCurrentUser } from "@/lib/auth/session";
import { listAdminAccountDeletionRequests } from "@/lib/server/account-deletion-request-service";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });

    const params = new URL(request.url).searchParams;
    const statusValue = params.get("status");
    const status = ACCOUNT_DELETION_REQUEST_STATUSES.includes(statusValue as AccountDeletionRequestStatus) ? (statusValue as AccountDeletionRequestStatus) : undefined;
    const data = await listAdminAccountDeletionRequests({
        page: Number(params.get("page") || 1),
        pageSize: Number(params.get("pageSize") || 20),
        keyword: params.get("keyword") || "",
        status,
    });
    return NextResponse.json({ code: 0, data, msg: "OK" }, { headers: { "Cache-Control": "private, no-store" } });
}
