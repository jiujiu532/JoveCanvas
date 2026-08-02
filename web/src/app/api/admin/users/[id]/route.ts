import { NextResponse } from "next/server";

import { deleteUserByAdmin, isAuthInputError, updateUserByAdmin, type UserRole, type UserStatus } from "@/lib/auth/store";
import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteGenerationLogsByUserId } from "@/lib/server/generation-log-store";
import { auditActorFromRequest, safeRecordAuditLog } from "@/lib/server/audit-log-store";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        const { id } = await context.params;
        const body = await readJsonBody<{ displayName?: unknown; email?: unknown; password?: unknown; role?: unknown; status?: unknown; pointsBalance?: unknown; planId?: unknown }>(request);
        const patch: { displayName?: string; email?: string; password?: string; role?: UserRole; status?: UserStatus; pointsBalance?: number; planId?: string } = {};

        if (typeof body.displayName === "string") patch.displayName = body.displayName;
        if (typeof body.email === "string") patch.email = body.email;
        if (typeof body.password === "string" && body.password) patch.password = body.password;
        if (body.role === "admin" || body.role === "user") patch.role = body.role;
        if (body.status === "active" || body.status === "disabled") patch.status = body.status;
        if (body.pointsBalance !== undefined) patch.pointsBalance = Number(body.pointsBalance);
        if (typeof body.planId === "string") patch.planId = body.planId;

        const user = await updateUserByAdmin(currentUser.id, id, patch);
        await safeRecordAuditLog({
            action: "admin.user.update",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "user", id: user.id, label: user.username },
            metadata: { fields: Object.keys(patch), role: user.role, status: user.status, planId: user.planId, pointsBalance: user.pointsBalance },
        });
        return NextResponse.json({ user });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.user.update",
            status: "failure",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "user" },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Admin user update failed", error);
        return NextResponse.json({ error: await serverMessage("auth.userUpdateFailed") }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        const { id } = await context.params;
        await deleteUserByAdmin(currentUser.id, id);
        await deleteGenerationLogsByUserId(id);
        await safeRecordAuditLog({
            action: "admin.user.delete",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "user", id },
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        await safeRecordAuditLog({
            action: "admin.user.delete",
            status: "failure",
            actor: auditActorFromRequest(request, currentUser),
            target: { type: "user" },
            metadata: { error: error instanceof Error ? error.message : "unknown" },
        });
        if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Admin user delete failed", error);
        return NextResponse.json({ error: await serverMessage("auth.userDeleteFailed") }, { status: 500 });
    }
}
