import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { issueCoupon } from "@/lib/server/coupon-service";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const admin = await getCurrentUser();
    if (!admin) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const body = await readJsonBody<{ userId?: unknown; templateId?: unknown }>(request);
        const userId = typeof body.userId === "string" ? body.userId : "";
        const coupon = await issueCoupon({ userId, templateId: body.templateId, source: "admin" });
        await safeRecordAuditLog({ action: "admin.billing.coupon.grant", actor: auditActorFromRequest(request, admin), target: { type: "user_coupon", id: coupon.id }, metadata: { userId: coupon.userId, templateId: coupon.templateId } });
        return commerceOk({ coupon }, 201);
    } catch (error) {
        await safeRecordAuditLog({ action: "admin.billing.coupon.grant", status: "failure", actor: auditActorFromRequest(request, admin), target: { type: "user_coupon" }, metadata: { error: error instanceof Error ? error.message : "unknown" } });
        return await commerceError(error, "发放优惠券失败", "Admin grant coupon failed");
    }
}
