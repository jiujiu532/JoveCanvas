import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getAdminBillingSummary, isBillingInputError } from "@/lib/server/billing-service";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        const params = request.nextUrl.searchParams;
        return NextResponse.json({
            summary: await getAdminBillingSummary({
                startDate: params.get("startDate") || undefined,
                endDate: params.get("endDate") || undefined,
            }),
        });
    } catch (error) {
        if (isBillingInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Admin billing summary failed", error);
        return NextResponse.json({ error: "获取财务钱包摘要失败" }, { status: 500 });
    }
}
