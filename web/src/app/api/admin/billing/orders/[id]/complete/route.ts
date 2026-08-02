import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { completeBillingOrderPayment, isBillingInputError } from "@/lib/server/billing-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        const { id } = await context.params;
        const body = await readJsonBody<{ provider?: unknown; channel?: unknown; providerTradeId?: unknown; providerPaymentId?: unknown; rawPayload?: unknown; paidAt?: unknown }>(request);
        const result = await completeBillingOrderPayment({
            orderId: id,
            provider: body.provider,
            channel: body.channel,
            providerTradeId: body.providerTradeId,
            providerPaymentId: body.providerPaymentId,
            rawPayload: body.rawPayload ?? body,
            paidAt: body.paidAt,
        });
        await safeRecordAuditLog({
            action: "admin.billing.order.complete",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "billing_order", id: result.order.id, label: result.order.orderNo },
            metadata: {
                userId: result.order.userId,
                planId: result.order.planId,
                pointsGranted: result.pointsGranted,
                amountCents: result.order.amountCents,
                currency: result.order.currency,
            },
        });
        return NextResponse.json(result);
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.billing.order.complete",
            status: "failure",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "billing_order" },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        if (isBillingInputError(error)) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error("Admin complete billing order failed", error);
        return NextResponse.json({ error: await serverMessage("billing.confirmPaymentFailed") }, { status: 500 });
    }
}
