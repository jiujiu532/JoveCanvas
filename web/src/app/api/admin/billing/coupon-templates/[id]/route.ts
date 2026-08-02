import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { deleteCouponTemplate, saveCouponTemplate, type CouponTemplateInput } from "@/lib/server/coupon-service";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const { id } = await context.params;
    try {
        const template = await saveCouponTemplate({ ...(await readJsonBody<CouponTemplateInput>(request)), id, createdByUserId: user.id });
        if (!template) throw new Error("Coupon template was not persisted");
        await safeRecordAuditLog({
            action: "admin.billing.coupon-template.save",
            actor: auditActorFromRequest(request, user),
            target: { type: "coupon_template", id: template.id, label: template.name },
            metadata: { enabled: template.enabled, claimable: template.claimable },
        });
        return commerceOk({ template });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.billing.coupon-template.save",
            status: "failure",
            actor: auditActorFromRequest(request, user),
            target: { type: "coupon_template", id },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        return await commerceError(error, "更新优惠券模板失败", "Admin update coupon template failed");
    }
}

export async function DELETE(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const { id } = await context.params;
    try {
        const template = await deleteCouponTemplate(id);
        await safeRecordAuditLog({ action: "admin.billing.coupon-template.delete", actor: auditActorFromRequest(request, user), target: { type: "coupon_template", id: template.id, label: template.name } });
        return commerceOk({ template });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.billing.coupon-template.delete",
            status: "failure",
            actor: auditActorFromRequest(request, user),
            target: { type: "coupon_template", id },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        return await commerceError(error, "删除优惠券模板失败", "Admin delete coupon template failed");
    }
}
