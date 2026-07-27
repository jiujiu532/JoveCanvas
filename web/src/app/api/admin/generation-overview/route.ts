import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getAdminGenerationOverviewSummary } from "@/lib/server/generation-overview-service";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        return NextResponse.json({ code: 0, data: await getAdminGenerationOverviewSummary(), msg: "OK" });
    } catch (error) {
        console.error("Admin generation overview failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("admin.generationOpsSummaryFailed") }, { status: 500 });
    }
}
