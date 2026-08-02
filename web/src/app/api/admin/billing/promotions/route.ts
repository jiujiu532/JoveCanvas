import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { listPromotionCampaigns, savePromotionCampaign, type PromotionCampaignInput } from "@/lib/server/promotion-service";
import { commerceError, commerceOk } from "@/app/api/billing/commerce-response";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const params = request.nextUrl.searchParams;
        const result = await listPromotionCampaigns({ page: Number(params.get("page")) || 1, pageSize: Number(params.get("pageSize")) || 20, includeDisabled: true });
        return commerceOk({ campaigns: result.items, total: result.total, page: result.page, pageSize: result.pageSize });
    } catch (error) {
        return await commerceError(error, "获取促销活动失败", "Admin list promotions failed");
    }
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const campaign = await savePromotionCampaign({ ...(await readJsonBody<PromotionCampaignInput>(request)), createdByUserId: user.id });
        if (!campaign) throw new Error("Promotion was not persisted");
        await safeRecordAuditLog({
            action: "admin.billing.promotion.save",
            actor: auditActorFromRequest(request, user),
            target: { type: "promotion_campaign", id: campaign.id, label: campaign.name },
            metadata: { enabled: campaign.enabled, productCount: campaign.products.length },
        });
        return commerceOk({ campaign }, 201);
    } catch (error) {
        await safeRecordAuditLog({ action: "admin.billing.promotion.save", status: "failure", actor: auditActorFromRequest(request, user), target: { type: "promotion_campaign" }, metadata: { error: error instanceof Error ? error.message : "unknown" } });
        return await commerceError(error, "保存促销活动失败", "Admin save promotion failed");
    }
}
