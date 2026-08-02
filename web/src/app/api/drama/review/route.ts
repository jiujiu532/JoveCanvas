import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/auth/request";
import { isAuthInputError } from "@/lib/auth/store";
import { reviewCreativeOutputs } from "@/lib/server/creative-review-service";
import { normalizeDramaVisualReviewInput } from "@/lib/server/drama-visual-review";
import { resolveInternalOrigin } from "@/lib/server/internal-origin";
import { checkRateLimit } from "@/lib/server/security";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (!(await checkRateLimit(`drama-review:${user.id}`, { maxRequests: 8, windowMs: 60_000 })).allowed)
        return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimitedFeatureRetry", { feature: await serverMessage("features.visualReview") }) }, { status: 429 });
    let body: unknown;
    try {
        body = await readJsonBody(request, 2 * 1024 * 1024);
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage(error) }, { status: error.status });
        throw error;
    }
    const input = normalizeDramaVisualReviewInput(body);
    if (!input.tasks.length) return NextResponse.json({ code: 400, data: null, msg: await serverMessage("drama.storyboardRequired") }, { status: 400 });
    const review = await reviewCreativeOutputs({
        origin: resolveInternalOrigin(new URL(request.url).origin),
        cookie: request.headers.get("cookie") || "",
        userId: user.id,
        foundation: input.foundation,
        tasks: input.tasks,
    });
    return NextResponse.json({ code: 0, data: { review }, msg: await serverMessage("drama.visualReviewDone") });
}
