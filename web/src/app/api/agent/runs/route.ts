import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { CreativeRuntimeInputError, normalizeCreativeRunRequest, normalizeCreativeSurface } from "@/lib/creative-runtime-contract";
import { readJsonBody } from "@/lib/auth/request";
import { checkRateLimit } from "@/lib/server/security";
import { withGenerationConcurrencyLimit } from "@/lib/server/generation-task-store";
import { createAgentRun, getAgentRunByClientRequestId, listAgentRuns } from "@/lib/server/agent-run-store";
import { CreativeStoreConflict } from "@/lib/server/creative-runtime-store";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export async function GET(request: Request) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId")?.trim() || "";
    const conversationId = url.searchParams.get("conversationId")?.trim() || "";
    const surface = normalizeCreativeSurface(url.searchParams.get("surface"));
    const runs = (await listAgentRuns(user.id, 50))
        .filter((run) => (!projectId || run.projectId === projectId) && (!conversationId || run.conversationId === conversationId) && (!surface || run.surface === surface))
        .map((run) => ({ ...run, snapshot: undefined }));
    const activeTaskIds = runs.filter((run) => run.status === "planning" || run.status === "running").map((run) => run.id);
    if (activeTaskIds.length) {
        const origin = resolveInternalOrigin(url.origin);
        after(() => runGenerationTaskRecoveryBatch({ origin, cookie: request.headers.get("cookie") || "", limit: Math.min(50, activeTaskIds.length), taskIds: activeTaskIds }));
    }
    return NextResponse.json({ code: 0, data: { runs }, msg: "OK" });
}

export async function POST(request: Request) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const input = normalizeCreativeRunRequest(await readJsonBody<unknown>(request));
        const existing = await getAgentRunByClientRequestId(user.id, input.clientRequestId);
        if (existing) return NextResponse.json({ code: 0, data: { run: existing, created: false }, msg: await serverMessage("tasks.agentExists") });
        const rate = await checkRateLimit(`agent-run:${user.id}`, { maxRequests: 10, windowMs: 60 * 1000 });
        if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimitedFeatureRetry", { feature: await serverMessage("features.agent") }) }, { status: 429 });
        const settings = await getAuthSettings();
        const response = await withGenerationConcurrencyLimit(user.id, "agent", 10 * 60 * 1000, settings.generationConcurrency.agent, async () => {
            const created = await createAgentRun(user.id, input);
            if (created.created) {
                const origin = resolveInternalOrigin(new URL(request.url).origin);
                await scheduleGenerationTask("agent", created.run.id, { executionPhase: "created", nextPollAt: Date.now(), lastUpstreamStatus: "created" });
                after(() => runGenerationTaskRecoveryBatch({ origin, cookie: request.headers.get("cookie") || "", limit: 1, taskIds: [created.run.id] }));
            }
            return NextResponse.json({
                code: 0,
                data: { run: created.run, conversation: created.conversation, created: created.created },
                msg: created.created ? await serverMessage("tasks.agentCreated") : await serverMessage("tasks.agentExists"),
            });
        });
        return response || NextResponse.json({ code: 429, data: null, msg: await serverMessage("agent.concurrencyLimit", { limit: settings.generationConcurrency.agent }) }, { status: 429 });
    } catch (error) {
        if (error instanceof CreativeRuntimeInputError || error instanceof CreativeStoreConflict) {
            return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
        }
        throw error;
    }
}
