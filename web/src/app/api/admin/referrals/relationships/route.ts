import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { listAdminReferralRelationships } from "@/lib/server/referral-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const query = new URL(request.url).searchParams;
        return commerceOk(
            await listAdminReferralRelationships({
                page: query.get("page"),
                pageSize: query.get("pageSize"),
                keyword: query.get("keyword"),
                riskStatus: query.get("riskStatus"),
            }),
        );
    } catch (error) {
        return await commerceError(error, "加载邀请关系失败", "List referral relationships failed");
    }
}
