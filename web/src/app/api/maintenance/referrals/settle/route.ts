import { NextResponse } from "next/server";

import { isAuthorizedMaintenanceRequest, isMaintenanceTokenConfigured } from "@/lib/server/maintenance-auth";
import { settleDueReferralRewards } from "@/lib/server/referral-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    if (!isMaintenanceTokenConfigured()) return NextResponse.json({ code: 503, data: null, msg: await serverMessage("admin.maintenanceTokenMissing") }, { status: 503 });
    if (!isAuthorizedMaintenanceRequest(request)) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("admin.maintenanceAuthFailed") }, { status: 401 });
    try {
        const result = await settleDueReferralRewards({ limit: 100 });
        return NextResponse.json({ code: 0, data: result, msg: result.processed ? `已处理 ${result.processed} 组到期邀请奖励` : "没有到期邀请奖励" });
    } catch (error) {
        console.error("Settle referral rewards failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("billing.settleReferralFailed") }, { status: 500 });
    }
}
