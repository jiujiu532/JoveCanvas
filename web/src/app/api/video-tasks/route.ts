import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings, isAuthInputError } from "@/lib/auth/store";
import { generationModelId, rawModelName, toSystemGenerationChannel } from "@/lib/server/generation-channel";
import { withGenerationConcurrencyLimit } from "@/lib/server/generation-task-store";
import { resolveLogicalModel } from "@/lib/server/logical-model-router";
import { createVideoTask } from "@/lib/server/video-task-store";
import { sanitizeRegisteredVideoUpstream, type RegisteredVideoUpstreamInput } from "@/lib/server/video-task-registration";
import { checkGenerationRateLimit, rateLimitHeaders } from "@/lib/server/security";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateVideoTaskBody = {
    config?: { apiSource?: string; baseUrl?: string; apiFormat?: string; model?: string };
    upstream?: RegisteredVideoUpstreamInput;
};

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const rate = await checkGenerationRateLimit(user.id, request, "video");
    if (!rate.allowed) return NextResponse.json({ error: await serverMessage("common.rateLimitedFeatureRetry", { feature: await serverMessage("features.videoTask") }) }, { status: 429, headers: rateLimitHeaders(rate) });
    const settings = await getAuthSettings();
    const response = await withGenerationConcurrencyLimit(user.id, "video", 10 * 60 * 1000, settings.generationConcurrency.video, async () => {
        let body: CreateVideoTaskBody;
        try {
            body = await readJsonBody(request);
        } catch (error) {
            if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
            throw error;
        }
        const resolved = resolveLogicalModel(settings, "video", body.config?.model || settings.defaultModels.videoModel);
        const config = resolved ? toSystemGenerationChannel(resolved) : null;
        const upstream = sanitizeRegisteredVideoUpstream(body.upstream);
        if (!config || !resolved || !upstream || ![config.model, resolved.logicalModelId].map(rawModelName).includes(rawModelName(upstream.model))) return NextResponse.json({ error: await serverMessage("tasks.videoParamsIncomplete") }, { status: 400 });
        const task = await createVideoTask({ userId: user.id, config, upstream: { ...upstream, model: config.model } });
        return NextResponse.json({ task: publicTask(task) });
    });
    return response || NextResponse.json({ error: await serverMessage("tasks.videoConcurrencyLimit") }, { status: 429 });
}

function publicTask(task: Awaited<ReturnType<typeof createVideoTask>>) {
    return { id: task.id, status: task.status, model: generationModelId(task.config), upstreamId: task.upstream.id };
}
