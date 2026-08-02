import { NextResponse } from "next/server";

import { expirePendingBillingOrders } from "@/lib/server/billing-order-expiration-service";
import { isAuthorizedMaintenanceRequest, isMaintenanceTokenConfigured } from "@/lib/server/maintenance-auth";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    if (!isMaintenanceTokenConfigured()) return NextResponse.json({ code: 503, data: null, msg: await serverMessage("admin.maintenanceTokenMissing") }, { status: 503 });
    if (!isAuthorizedMaintenanceRequest(request)) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("admin.maintenanceAuthFailed") }, { status: 401 });

    try {
        const expired = await expirePendingBillingOrders({ limit: 500 });
        return NextResponse.json({ code: 0, data: { expired: expired.length }, msg: expired.length ? `已关闭 ${expired.length} 笔过期订单` : "没有需要关闭的过期订单" });
    } catch (error) {
        console.error("Expire billing orders failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("billing.closeExpiredOrdersFailed") }, { status: 500 });
    }
}
