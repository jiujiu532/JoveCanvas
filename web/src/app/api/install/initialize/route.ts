import { NextResponse } from "next/server";

import { initializeInstallDatabase, InstallInitializationError } from "@/lib/server/install-status";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

export async function POST() {
    try {
        const install = await initializeInstallDatabase();
        return NextResponse.json({ code: 0, data: { install }, msg: await serverMessage("install.dbInitDone") });
    } catch (error) {
        if (error instanceof InstallInitializationError) return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Install initialization route failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("install.dbInitFailed") }, { status: 500 });
    }
}
