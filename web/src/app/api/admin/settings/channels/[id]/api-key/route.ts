import { NextResponse } from "next/server";

import { getAuthSettings } from "@/lib/auth/store";
import { getCurrentUser } from "@/lib/auth/session";
import { isUsableAdminChannelApiKey } from "@/lib/server/admin-channel-config";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const noStoreHeaders = {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
};

export async function GET(request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return json({ error: await serverMessage("common.pleaseLogin") }, 401);
    if (currentUser.role !== "admin") return json({ error: await serverMessage("common.adminRequired") }, 403);

    try {
        const { id } = await context.params;
        const settings = await getAuthSettings();
        const channel = settings.systemChannels.find((item) => item.id === id);
        if (!channel) return json({ error: await serverMessage("admin.channelNotFound") }, 404);
        if (!isUsableAdminChannelApiKey(channel.apiKey)) return json({ error: await serverMessage("admin.channelNoApiKey") }, 404);

        await safeRecordAuditLog({
            action: "admin.settings.channel_api_key.view",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "system-model-channel", id: channel.id, label: channel.name },
        });
        return json({ apiKey: channel.apiKey });
    } catch (error) {
        console.error("Admin channel API key reveal failed", error);
        return json({ error: await serverMessage("admin.readApiKeyFailed") }, 500);
    }
}

function json(body: { apiKey?: string; error?: string }, status = 200) {
    return NextResponse.json(body, { status, headers: noStoreHeaders });
}
