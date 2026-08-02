import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { settleDueReferralRewards } from "@/lib/server/referral-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const result = await settleDueReferralRewards({ limit: 100 });
        await safeRecordAuditLog({ action: "admin.referrals.rewards.settle", actor: auditActorFromRequest(request, admin), target: { type: "referral_rewards" }, metadata: result });
        return commerceOk(result);
    } catch (error) {
        await safeRecordAuditLog({ action: "admin.referrals.rewards.settle", status: "failure", actor: auditActorFromRequest(request, admin), target: { type: "referral_rewards" }, metadata: { error: error instanceof Error ? error.message : "unknown" } });
        return await commerceError(error, "结算邀请奖励失败", "Settle referral rewards failed");
    }
}
