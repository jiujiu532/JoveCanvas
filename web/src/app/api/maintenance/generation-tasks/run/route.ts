import { NextResponse } from "next/server";

import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { isAuthorizedMaintenanceRequest, isMaintenanceTokenConfigured } from "@/lib/server/maintenance-auth";
import { recordGenerationWorkerHeartbeat } from "@/lib/server/generation-worker-heartbeat";
import { getInstallStatus } from "@/lib/server/install-status";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    if (!isMaintenanceTokenConfigured()) return NextResponse.json({ code: 503, data: null, msg: await serverMessage("admin.maintenanceTokenMissing") }, { status: 503 });
    if (!isAuthorizedMaintenanceRequest(request)) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("admin.maintenanceAuthFailed") }, { status: 401 });
    try {
        if (!(await getInstallStatus()).database.schemaReady) return NextResponse.json({ code: 0, data: { claimed: 0 }, msg: await serverMessage("install.waitingDatabase") });
        const workerId = request.headers.get("x-vozeb-pro-worker-id")?.trim();
        if (workerId) await recordGenerationWorkerHeartbeat(workerId);
        const result = await runGenerationTaskRecoveryBatch({
            origin: resolveInternalOrigin(new URL(request.url).origin),
            publicOrigin: process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin,
            limit: 50,
            workerId: workerId || undefined,
        });
        return NextResponse.json({ code: 0, data: result, msg: result.claimed ? `已处理 ${result.claimed} 个生成任务` : "没有到期的生成任务" });
    } catch (error) {
        console.error("Generation task recovery batch failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("tasks.recoveryFailed") }, { status: 500 });
    }
}
