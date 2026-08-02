import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { deletePromotionCampaign, savePromotionCampaign, type PromotionCampaignInput } from "@/lib/server/promotion-service";
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
        const campaign = await savePromotionCampaign({ ...(await readJsonBody<PromotionCampaignInput>(request)), id, createdByUserId: user.id });
        if (!campaign) throw new Error("Promotion was not persisted");
        await safeRecordAuditLog({
            action: "admin.billing.promotion.save",
            actor: auditActorFromRequest(request, user),
            target: { type: "promotion_campaign", id: campaign.id, label: campaign.name },
            metadata: { enabled: campaign.enabled, productCount: campaign.products.length },
        });
        return commerceOk({ campaign });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.billing.promotion.save",
            status: "failure",
            actor: auditActorFromRequest(request, user),
            target: { type: "promotion_campaign", id },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        return await commerceError(error, "更新促销活动失败", "Admin update promotion failed");
    }
}

export async function DELETE(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    const { id } = await context.params;
    try {
        const campaign = await deletePromotionCampaign(id);
        await safeRecordAuditLog({ action: "admin.billing.promotion.delete", actor: auditActorFromRequest(request, user), target: { type: "promotion_campaign", id: campaign.id, label: campaign.name } });
        return commerceOk({ campaign });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.billing.promotion.delete",
            status: "failure",
            actor: auditActorFromRequest(request, user),
            target: { type: "promotion_campaign", id },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        return await commerceError(error, "删除促销活动失败", "Admin delete promotion failed");
    }
}
