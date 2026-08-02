import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { createChannelProtocolDraft, ProtocolDraftError } from "@/lib/server/channel-protocol-assistant";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftBody = {
    documentationUrl?: string;
    documentationText?: string;
    examples?: string;
    useTextModel?: boolean;
};

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });
    try {
        const body = await readJsonBody<DraftBody>(request, 1024 * 1024);
        const draft = await createChannelProtocolDraft({ requestUrl: request.url, cookie: request.headers.get("cookie") || "", userId: currentUser.id, ...body });
        return NextResponse.json({ draft }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        if (error instanceof ProtocolDraftError) return NextResponse.json({ error: error.message }, { status: error.status });
        console.error("Channel protocol draft failed", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: await serverMessage("admin.protocolAnalyzeFailed") }, { status: 502 });
    }
}
