import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { ffmpegAvailable } from "@/lib/server/ffmpeg";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const available = await ffmpegAvailable();
    return NextResponse.json({
        code: 0,
        data: { available },
        msg: available ? await serverMessage("tasks.ffmpegReady") : await serverMessage("drama.ffmpegMissing"),
    });
}
