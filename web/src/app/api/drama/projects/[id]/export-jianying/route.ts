import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { exportDramaEpisodeAsJianying, DramaJianyingExportError } from "@/lib/server/drama-jianying-export";
import { getDramaProjectForUser, DramaProjectServiceError } from "@/lib/server/drama-project-service";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const body = (await request.json().catch(() => ({}))) as { episodeId?: string; draftPath?: string; version?: string };
        const project = await getDramaProjectForUser(user.id, (await context.params).id);
        const episode = project.episodes.find((item) => item.id === String(body.episodeId || ""));
        if (!episode) return NextResponse.json({ code: 404, data: null, msg: await serverMessage("drama.episodeNotFound") }, { status: 404 });
        const result = await exportDramaEpisodeAsJianying({
            project,
            episode,
            draftPath: String(body.draftPath || ""),
            version: body.version === "5" ? "5" : "6",
            origin: resolveInternalOrigin(new URL(request.url).origin),
            cookie: request.headers.get("cookie") || "",
        });
        return new Response(result.data, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
                "Content-Length": String(result.data.byteLength),
            },
        });
    } catch (error) {
        if (error instanceof DramaProjectServiceError || error instanceof DramaJianyingExportError) return NextResponse.json({ code: error.status, data: null, msg: error.message }, { status: error.status });
        console.error("jianying draft export failed", error);
        return NextResponse.json({ code: 500, data: null, msg: await serverMessage("drama.jianyingExportFailed") }, { status: 500 });
    }
}
