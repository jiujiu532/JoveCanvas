import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });

    return NextResponse.json({ error: await serverMessage("billing.checkInDeprecated") }, { status: 410 });
}
