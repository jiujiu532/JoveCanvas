import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { buildAgentReadiness } from "@/lib/server/agent-readiness";
import { serverMessage } from "@/lib/server/server-messages";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
    return NextResponse.json({ code: 0, data: buildAgentReadiness(await getAuthSettings()), msg: "OK" });
}
