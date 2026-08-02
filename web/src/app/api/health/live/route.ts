import { NextResponse } from "next/server";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({ code: 0, data: { status: "live" }, msg: await serverMessage("health.running") }, { headers: { "cache-control": "no-store" } });
}
