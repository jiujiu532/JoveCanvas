import type { NextRequest } from "next/server";

import { forbidden, unauthorized, workPublicationError, workPublicationOk } from "@/app/api/_shared/work-publication-response";
import { getCurrentUser } from "@/lib/auth/session";
import { listWorkGovernanceCasesForAdmin } from "@/lib/server/work-governance-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return await unauthorized();
    if (user.role !== "admin") return await forbidden();
    try {
        const params = request.nextUrl.searchParams;
        return await workPublicationOk(
            await listWorkGovernanceCasesForAdmin({
                page: Number(params.get("page")) || 1,
                pageSize: Number(params.get("pageSize")) || 20,
                caseType: params.get("caseType"),
                status: params.get("status"),
                keyword: params.get("keyword"),
            }),
        );
    } catch (error) {
        return await workPublicationError(error, "获取举报申诉列表失败", "List work governance cases failed");
    }
}
