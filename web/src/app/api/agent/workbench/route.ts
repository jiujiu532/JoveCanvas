import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/auth/request";
import { isAuthInputError } from "@/lib/auth/store";
import { checkRateLimit } from "@/lib/server/security";
import { planWorkbenchAgent, WorkbenchPlanningError, type WorkbenchRequestBody } from "@/lib/server/workbench-agent-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const rate = await checkRateLimit(`agent-workbench:${user.id}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rate.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimitedFeatureRetry", { feature: await serverMessage("features.agent") }) }, { status: 429 });

    let body: WorkbenchRequestBody;
    try {
        body = await readJsonBody(request);
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
        throw error;
    }
    const prompt = String(body.prompt || "").trim();
    const submittedModels = Array.isArray(body.models) ? body.models : [];
    const selectedModels = Array.isArray(body.modelIds) ? body.modelIds : [];
    const submittedSkills = Array.isArray(body.skillIds) ? body.skillIds : [];
    if (!prompt) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("agent.requirementEmpty") }, { status: 400 });
    if (body.requestId !== undefined && (typeof body.requestId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(body.requestId))) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("tasks.agentRequestIdInvalid") }, { status: 400 });
    if (prompt.length > 4000 || String(body.previousPrompt || "").length > 8000 || String(body.conversationId || "").length > 160 || submittedModels.length > 100 || selectedModels.length > 6 || submittedSkills.length > 8)
        return NextResponse.json({ code: 400, data: null, msg: await serverMessage("tasks.agentPayloadTooLong") }, { status: 400 });

    try {
        const modelPlan = await planWorkbenchAgent({ requestUrl: request.url, cookie: request.headers.get("cookie") || "", userId: user.id, body, prompt, signal: request.signal });
        return NextResponse.json({ code: 0, data: modelPlan, msg: "OK" });
    } catch (error) {
        if (error instanceof WorkbenchPlanningError) return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Workbench Agent planning failed", error);
        return NextResponse.json({ code: 502, data: null, msg: await serverMessage("tasks.agentPlanFailed") }, { status: 502 });
    }
}
