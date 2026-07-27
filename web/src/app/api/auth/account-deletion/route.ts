import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { isAuthInputError } from "@/lib/auth/store";
import { AccountDeletionRequestError, getOwnAccountDeletionRequest, submitAccountDeletionRequest, withdrawOwnAccountDeletionRequest } from "@/lib/server/account-deletion-request-service";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/security";

import { serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    return NextResponse.json({ code: 0, data: await getOwnAccountDeletionRequest(currentUser.id), msg: "OK" }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    const limit = await checkRateLimit(`account-deletion-submit:${currentUser.id}`, { maxRequests: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ code: 429, data: null, msg: await serverMessage("common.rateLimitedFeatureAgain", { feature: await serverMessage("features.operation") }) }, { status: 429, headers: rateLimitHeaders(limit) });

    try {
        const body = await readJsonBody<{ currentPassword?: unknown; note?: unknown }>(request);
        const data = await submitAccountDeletionRequest(currentUser, {
            currentPassword: typeof body.currentPassword === "string" ? body.currentPassword : "",
            note: typeof body.note === "string" ? body.note : "",
        });
        await safeRecordAuditLog({
            action: "account.deletion.submit",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "account_deletion_request", id: data.id, label: currentUser.username },
        });
        return NextResponse.json({ code: 0, data, msg: await serverMessage("auth.deletionSubmitted") });
    } catch (error) {
        const mapped = mapError(error, await serverMessage("auth.deletionSubmitFailed"));
        return NextResponse.json({ code: mapped.status, data: null, msg: mapped.message }, { status: mapped.status });
    }
}

export async function DELETE(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    try {
        const data = await withdrawOwnAccountDeletionRequest(currentUser.id);
        await safeRecordAuditLog({
            action: "account.deletion.withdraw",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "account_deletion_request", id: data.id, label: currentUser.username },
        });
        return NextResponse.json({ code: 0, data, msg: await serverMessage("auth.deletionWithdrawn") });
    } catch (error) {
        const mapped = mapError(error, await serverMessage("auth.deletionWithdrawFailed"));
        return NextResponse.json({ code: mapped.status, data: null, msg: mapped.message }, { status: mapped.status });
    }
}

function mapError(error: unknown, fallback: string) {
    if (error instanceof AccountDeletionRequestError || isAuthInputError(error)) return { status: error.status, message: error.message };
    console.error(fallback, error);
    return { status: 500, message: fallback };
}
