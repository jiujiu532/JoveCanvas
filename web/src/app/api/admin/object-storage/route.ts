import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import type { ObjectStorageSettingsUpdate } from "@/lib/object-storage-contract";
import { getObjectStorageAdminSettings, saveObjectStorageAdminSettings } from "@/lib/server/object-storage-config";
import { checkConfiguredObjectStorage } from "@/lib/server/object-storage-service";
import { serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const denied = await requireAdmin();
    if (denied) return denied;
    return NextResponse.json({ code: 0, data: await getObjectStorageAdminSettings(), msg: "OK" }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        const raw = await request.json().catch(() => null);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return NextResponse.json({ code: 400, data: null, msg: await serverMessage("common.invalidJsonBody") }, { status: 400 });
        }
        const body = raw as Record<string, unknown>;
        const booleanFields = ["enabled", "forcePathStyle", "clearAccessKeyId", "clearSecretAccessKey"] as const;
        for (const field of booleanFields) {
            if (field in body && typeof body[field] !== "boolean") {
                return NextResponse.json({ code: 400, data: null, msg: await serverMessage("admin.fieldMustBeBoolean", { field }) }, { status: 400 });
            }
        }
        const stringFields = ["endpoint", "region", "bucket", "prefix", "accessKeyId", "secretAccessKey"] as const;
        for (const field of stringFields) {
            if (field in body && body[field] !== undefined && typeof body[field] !== "string") {
                return NextResponse.json({ code: 400, data: null, msg: await serverMessage("admin.fieldMustBeString", { field }) }, { status: 400 });
            }
        }
        const data = await saveObjectStorageAdminSettings({
            enabled: body.enabled === true,
            endpoint: stringValue(body.endpoint),
            region: stringValue(body.region),
            bucket: stringValue(body.bucket),
            prefix: stringValue(body.prefix),
            forcePathStyle: body.forcePathStyle === true,
            accessKeyId: stringValue(body.accessKeyId),
            secretAccessKey: stringValue(body.secretAccessKey),
            clearAccessKeyId: body.clearAccessKeyId === true,
            clearSecretAccessKey: body.clearSecretAccessKey === true,
        } satisfies ObjectStorageSettingsUpdate);
        return NextResponse.json({ code: 0, data, msg: await serverMessage("media.externalStorageSaved") }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        return NextResponse.json({ code: 400, data: null, msg: error instanceof Error ? error.message : "外部存储配置保存失败" }, { status: 400 });
    }
}

export async function POST() {
    const denied = await requireAdmin();
    if (denied) return denied;
    try {
        await checkConfiguredObjectStorage();
        return NextResponse.json({ code: 0, data: { available: true }, msg: await serverMessage("media.externalStorageOk") });
    } catch (error) {
        console.error("Object storage connection test failed", error);
        return NextResponse.json({ code: 502, data: { available: false }, msg: await serverMessage("media.externalStorageConnectFailed") }, { status: 502 });
    }
}

async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
    return user.role === "admin" ? null : NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : "";
}
