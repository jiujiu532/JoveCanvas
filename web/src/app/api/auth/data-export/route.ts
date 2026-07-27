import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings } from "@/lib/auth/store";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/security";
import { buildUserDataExport } from "@/lib/server/user-data-export-service";
import { siteFileSlug } from "@/lib/site-brand";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });

    const limit = await checkRateLimit(`personal-data-export:${currentUser.id}`, { maxRequests: 3, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: await serverMessage("common.rateLimitedFeatureAgain", { feature: await serverMessage("features.export") }) }, { status: 429, headers: rateLimitHeaders(limit) });

    try {
        const exportedAt = new Date();
        const settings = await getAuthSettings();
        const fileName = `${siteFileSlug(settings.site.title)}-personal-data-${exportedAt.toISOString().slice(0, 10)}.json`;
        const data = await buildUserDataExport(currentUser.id);
        return new NextResponse(JSON.stringify(data, null, 2), {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("personal data export failed", error);
        return NextResponse.json({ error: await serverMessage("auth.exportFailed") }, { status: 500 });
    }
}
