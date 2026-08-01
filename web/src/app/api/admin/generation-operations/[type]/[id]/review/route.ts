import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { GenerationTaskReviewError, reviewGenerationTask, type GenerationTaskReviewInput, type ReviewableGenerationTaskType } from "@/lib/server/generation-task-review-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

export async function POST(request: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ code: 403, data: null, msg: "需要管理员权限" }, { status: 403 });
    const { type, id } = await params;
    if (!isReviewableType(type)) return NextResponse.json({ code: 400, data: null, msg: "任务类型不支持人工确认" }, { status: 400 });
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: "请求体格式无效" }, { status: 400 });
    }
    const action = body.action;
    if (action !== "resume_upstream" && action !== "provide_result" && action !== "confirm_failed") {
        return NextResponse.json({ code: 400, data: null, msg: "人工确认操作无效" }, { status: 400 });
    }
    let reviewInput: GenerationTaskReviewInput;
    if (action === "resume_upstream") {
        if (typeof body.upstreamTaskId !== "string" || !body.upstreamTaskId.trim()) {
            return NextResponse.json({ code: 400, data: null, msg: "请输入上游任务 ID" }, { status: 400 });
        }
        reviewInput = { action: "resume_upstream", upstreamTaskId: body.upstreamTaskId.trim(), origin: resolveInternalOrigin(new URL(request.url).origin) };
    } else if (action === "provide_result") {
        if (typeof body.result !== "string" || !body.result.trim()) {
            return NextResponse.json({ code: 400, data: null, msg: "请输入结果内容" }, { status: 400 });
        }
        reviewInput = { action: "provide_result", result: body.result };
    } else {
        if ("reason" in body && body.reason !== undefined && typeof body.reason !== "string") {
            return NextResponse.json({ code: 400, data: null, msg: "reason 必须是字符串" }, { status: 400 });
        }
        reviewInput = { action: "confirm_failed", reason: typeof body.reason === "string" ? body.reason : undefined };
    }
    try {
        const data = await reviewGenerationTask(type, id, reviewInput);
        return NextResponse.json({ code: 0, data, msg: "任务接管状态已更新" });
    } catch (error) {
        if (error instanceof GenerationTaskReviewError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("Generation task review failed", { type, id, error: error instanceof Error ? error.message : "unknown" });
        return NextResponse.json({ code: 500, data: null, msg: "任务接管失败" }, { status: 500 });
    }
}

function isReviewableType(value: string): value is ReviewableGenerationTaskType {
    return value === "text" || value === "image" || value === "video" || value === "audio";
}
