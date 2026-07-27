import { after, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { abortAgentRun, executeAgentRun } from "@/lib/server/agent-run-executor";
import { getAgentRun, setAgentRunStatus, type AgentRun, type AgentRunStatus } from "@/lib/server/agent-run-store";
import { withGenerationConcurrencyLimit } from "@/lib/server/generation-task-store";
import { fetchInternalApi, resolveInternalOrigin } from "@/lib/server/internal-origin";

import { serverMessage } from "@/lib/server/server-messages";
const actions: Record<string, AgentRunStatus> = { pause: "paused", resume: "running", cancel: "cancelled" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const { id, action } = await params;
    const status = actions[action];
    if (!status) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("agent.unsupportedAction") }, { status: 400 });
    const run = await getAgentRun(id);
    if (!run || (run.userId !== user.id && user.role !== "admin")) return NextResponse.json({ code: 404, data: null, msg: await serverMessage("tasks.agentNotFound") }, { status: 404 });
    if (action === "pause" && !["planning", "running"].includes(run.status)) return NextResponse.json({ code: 409, data: null, msg: await serverMessage("agent.cannotPause") }, { status: 409 });
    if (action === "resume" && run.status !== "paused") return NextResponse.json({ code: 409, data: null, msg: await serverMessage("agent.onlyPausedCanResume") }, { status: 409 });
    const limit = action === "resume" ? (await getAuthSettings()).generationConcurrency.agent : 0;
    if (action === "cancel" && ["completed", "failed", "cancelled"].includes(run.status)) return NextResponse.json({ code: 409, data: null, msg: await serverMessage("tasks.cannotCancel") }, { status: 409 });
    if (action !== "resume") abortAgentRun(run.id);
    const result = action === "resume" ? await withGenerationConcurrencyLimit(run.userId, "agent", 10 * 60 * 1000, limit, async () => ({ updated: await setAgentRunStatus(run, status) })) : { updated: await setAgentRunStatus(run, status) };
    if (result === null) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("tasks.agentConcurrencyLimit", { limit }) }, { status: 429 });
    const { updated } = result;
    if (!updated) return NextResponse.json({ code: 409, data: null, msg: await serverMessage("tasks.agentStatusChanged") }, { status: 409 });
    const origin = resolveInternalOrigin(new URL(request.url).origin);
    const cookie = request.headers.get("cookie") || "";
    if (action === "cancel") await cancelChildTasks(run.tasks, origin, cookie);
    if (action === "resume") after(() => executeAgentRun(updated, origin, cookie));
    return NextResponse.json({ code: 0, data: { run: updated }, msg: "OK" });
}

async function cancelChildTasks(tasks: AgentRun["tasks"], origin: string, cookie: string) {
    await Promise.all(
        tasks
            .filter((task) => task.status === "running" && task.taskId && ["text", "image", "video", "audio"].includes(task.type))
            .map((task) =>
                fetchInternalApi(`${origin}/api/${task.type}-tasks/${encodeURIComponent(task.taskId!)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", cookie },
                    body: JSON.stringify({ status: "cancelled" }),
                }).catch(() => null),
            ),
    );
}
