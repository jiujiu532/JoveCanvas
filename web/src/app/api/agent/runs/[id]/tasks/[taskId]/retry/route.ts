import { after, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { executeAgentRun } from "@/lib/server/agent-run-executor";
import { getAgentRun, updateAgentRunById } from "@/lib/server/agent-run-store";
import { withGenerationConcurrencyLimit } from "@/lib/server/generation-task-store";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

import { serverMessage } from "@/lib/server/server-messages";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const { id, taskId } = await params;
    const run = await getAgentRun(id);
    if (!run || (run.userId !== user.id && user.role !== "admin")) return NextResponse.json({ code: 404, data: null, msg: await serverMessage("tasks.agentNotFound") }, { status: 404 });
    const task = run.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "failed") return NextResponse.json({ code: 409, data: null, msg: await serverMessage("agent.onlyFailedCanRetry") }, { status: 409 });
    const limit = (await getAuthSettings()).generationConcurrency.agent;
    const tasks = run.tasks.map((item) => {
        if (item.id !== taskId) return item;
        const completedChildren = item.childTasks?.filter((child) => child.status === "completed") || [];
        return {
            ...item,
            status: "ready" as const,
            attempts: 0,
            taskId: completedChildren.at(-1)?.id,
            taskIds: completedChildren.length ? completedChildren.map((child) => child.id) : undefined,
            childTasks: completedChildren.length ? completedChildren : undefined,
            result: undefined,
            error: undefined,
        };
    });
    const result = await withGenerationConcurrencyLimit(run.userId, "agent", 10 * 60 * 1000, limit, async () => ({
        updated: await updateAgentRunById(run.id, { status: "running", tasks }, { type: "task.retry.requested", data: { taskId } }, [run.status]),
    }));
    if (result === null) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("tasks.agentConcurrencyLimit", { limit }) }, { status: 429 });
    const { updated } = result;
    if (!updated) return NextResponse.json({ code: 404, data: null, msg: await serverMessage("tasks.agentNotFound") }, { status: 404 });
    after(() => executeAgentRun(updated, resolveInternalOrigin(new URL(request.url).origin), request.headers.get("cookie") || ""));
    return NextResponse.json({ code: 0, data: { run: updated }, msg: "OK" });
}
