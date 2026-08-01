import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { createDramaProjectForUser, DramaProjectServiceError, listDramaProjectSummariesForUser } from "@/lib/server/drama-project-service";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const result = await listDramaProjectSummariesForUser(user.id, {
        page: Math.max(1, Number(params.get("page")) || 1),
        pageSize: Math.max(1, Math.min(100, Number(params.get("pageSize")) || 20)),
    });
    return NextResponse.json({ code: 0, data: { projects: result.items, total: result.total, page: result.page, pageSize: result.pageSize }, msg: "OK" });
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return NextResponse.json({ code: 400, data: null, msg: "请求体格式无效" }, { status: 400 });
    }
    if ("title" in body && body.title !== undefined && typeof body.title !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: "title 必须是字符串" }, { status: 400 });
    }
    if ("sourceHandoffId" in body && body.sourceHandoffId !== undefined && typeof body.sourceHandoffId !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: "sourceHandoffId 必须是字符串" }, { status: 400 });
    }
    if ("summary" in body && body.summary !== undefined && typeof body.summary !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: "summary 必须是字符串" }, { status: 400 });
    }
    if ("style" in body && body.style !== undefined && typeof body.style !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: "style 必须是字符串" }, { status: 400 });
    }
    if ("ratio" in body && body.ratio !== undefined && typeof body.ratio !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: "ratio 必须是字符串" }, { status: 400 });
    }
    if ("initialScript" in body && body.initialScript !== undefined && typeof body.initialScript !== "string") {
        return NextResponse.json({ code: 400, data: null, msg: "initialScript 必须是字符串" }, { status: 400 });
    }
    if ("defaultVideoMode" in body && body.defaultVideoMode !== undefined && body.defaultVideoMode !== "storyboard" && body.defaultVideoMode !== "direct" && body.defaultVideoMode !== "reference") {
        return NextResponse.json({ code: 400, data: null, msg: "defaultVideoMode 无效" }, { status: 400 });
    }
    if ("sourceAssets" in body && body.sourceAssets !== undefined && !Array.isArray(body.sourceAssets)) {
        return NextResponse.json({ code: 400, data: null, msg: "sourceAssets 必须是数组" }, { status: 400 });
    }
    try {
        const project = await createDramaProjectForUser(user.id, body);
        return NextResponse.json({ code: 0, data: { project }, msg: "短剧项目已创建" });
    } catch (error) {
        if (error instanceof DramaProjectServiceError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        throw error;
    }
}
