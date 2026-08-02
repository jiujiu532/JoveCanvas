import { NextResponse } from "next/server";

import { createAnnouncement, isAuthInputError, listAnnouncementsPage, type PublicAnnouncement } from "@/lib/auth/store";
import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    const params = new URL(request.url).searchParams;
    const page = await listAnnouncementsPage(true, {
        page: positiveInteger(params.get("page"), 1),
        pageSize: positiveInteger(params.get("pageSize"), 12),
    });
    return NextResponse.json({ announcements: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
}

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        const body = await readJsonBody<Partial<PublicAnnouncement>>(request);
        const announcement = await createAnnouncement(body);
        return NextResponse.json({ announcement });
    } catch (error) {
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Create announcement failed", error);
        return NextResponse.json({ error: await serverMessage("auth.announcementCreateFailed") }, { status: 500 });
    }
}

function positiveInteger(value: string | null, fallback: number) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
