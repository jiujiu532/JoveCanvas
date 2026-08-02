import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { listAdminReferralRewards } from "@/lib/server/referral-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const query = new URL(request.url).searchParams;
        return commerceOk(await listAdminReferralRewards({ page: query.get("page"), pageSize: query.get("pageSize"), status: query.get("status") }));
    } catch (error) {
        return await commerceError(error, "加载邀请奖励记录失败", "List referral rewards failed");
    }
}
