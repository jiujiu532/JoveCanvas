import { NextResponse } from "next/server";

import { recordGenerationWorkerHeartbeat } from "@/lib/server/generation-worker-heartbeat";
import { getInstallStatus } from "@/lib/server/install-status";
import { isAuthorizedMaintenanceRequest, isMaintenanceTokenConfigured } from "@/lib/server/maintenance-auth";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    if (!isMaintenanceTokenConfigured()) return NextResponse.json({ code: 503, data: null, msg: await serverMessage("admin.maintenanceTokenMissing") }, { status: 503 });
    if (!isAuthorizedMaintenanceRequest(request)) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("admin.maintenanceAuthFailed") }, { status: 401 });
    const workerId = request.headers.get("x-vozeb-pro-worker-id")?.trim();
    if (!workerId) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("tasks.workerIdRequired") }, { status: 400 });
    if (!(await getInstallStatus()).database.schemaReady) return NextResponse.json({ code: 0, data: { accepted: false }, msg: await serverMessage("install.waitingDatabase") });
    await recordGenerationWorkerHeartbeat(workerId);
    return NextResponse.json({ code: 0, data: { accepted: true }, msg: "OK" }, { headers: { "cache-control": "no-store" } });
}
