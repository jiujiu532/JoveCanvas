import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { updateReferralRelationshipRisk } from "@/lib/server/referral-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const { id } = await context.params;
    try {
        const body = await readJsonBody<{ riskStatus?: unknown; reason?: unknown }>(request);
        const relationship = await updateReferralRelationshipRisk({ id, riskStatus: body.riskStatus, reason: body.reason });
        await safeRecordAuditLog({
            action: "admin.referrals.relationship.risk.update",
            actor: auditActorFromRequest(request, admin),
            target: { type: "referral_relationship", id },
            metadata: { riskStatus: relationship?.riskStatus, reason: typeof body.reason === "string" ? body.reason.slice(0, 240) : "" },
        });
        return commerceOk({ relationship });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.referrals.relationship.risk.update",
            status: "failure",
            actor: auditActorFromRequest(request, admin),
            target: { type: "referral_relationship", id },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        return await commerceError(error, "更新邀请关系失败", "Update referral relationship failed");
    }
}
