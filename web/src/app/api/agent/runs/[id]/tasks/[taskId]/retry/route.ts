import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { getAgentRun, updateAgentRunById } from "@/lib/server/agent-run-store";
import { failedAgentTaskRetryOps, prepareFailedAgentTaskRetry } from "@/lib/server/agent-run-task-input";
import { runGenerationTaskRecoveryBatch } from "@/lib/server/generation-task-recovery-service";
import { scheduleGenerationTask } from "@/lib/server/generation-task-scheduler";
import { withGenerationConcurrencyLimit } from "@/lib/server/generation-task-store";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { serverMessage } from "@/lib/server/server-messages";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const { id, taskId } = await params;
    const run = await getAgentRun(id);
    if (!run || (run.userId !== user.id && user.role !== "admin")) return NextResponse.json({ code: 404, data: null, msg: await serverMessage("tasks.agentNotFound") }, { status: 404 });
    const task = run.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "failed") return NextResponse.json({ code: 409, data: null, msg: await serverMessage("agent.onlyFailedCanRetry") }, { status: 409 });
    const settings = await getAuthSettings();
    const limit = settings.generationConcurrency.agent;
    const tasks = run.tasks.map((item) => {
        if (item.id !== taskId) return item;
        const completedChildren = item.childTasks?.filter((child) => child.status === "completed") || [];
        return prepareFailedAgentTaskRetry(
            run,
            {
                ...item,
                status: "ready" as const,
                attempts: Math.max(1, item.attempts || 0),
                taskId: completedChildren.at(-1)?.id,
                taskIds: completedChildren.length ? completedChildren.map((child) => child.id) : undefined,
                childTasks: completedChildren.length ? completedChildren : undefined,
                result: undefined,
                error: undefined,
            },
            settings,
        );
    });
    const retriedTask = tasks.find((item) => item.id === taskId)!;
    const result = await withGenerationConcurrencyLimit(run.userId, "agent", 10 * 60 * 1000, limit, async () => ({
        updated: await updateAgentRunById(run.id, { status: "running", tasks }, { type: "task.retry.requested", data: { taskId, ops: failedAgentTaskRetryOps(run, retriedTask) } }, [run.status]),
    }));
    if (result === null) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("agent.concurrencyLimit", { limit }) }, { status: 429 });
    const { updated } = result;
    if (!updated) return NextResponse.json({ code: 404, data: null, msg: await serverMessage("tasks.agentNotFound") }, { status: 404 });
    const origin = resolveInternalOrigin(new URL(request.url).origin);
    const cookie = request.headers.get("cookie") || "";
    await scheduleGenerationTask("agent", updated.id, { executionPhase: "created", nextPollAt: Date.now(), lastUpstreamStatus: "task_retry" });
    after(() => runGenerationTaskRecoveryBatch({ origin, cookie, limit: 1, taskIds: [updated.id] }));
    return NextResponse.json({ code: 0, data: { run: updated }, msg: "OK" });
}
