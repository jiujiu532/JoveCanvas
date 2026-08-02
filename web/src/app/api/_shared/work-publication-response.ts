import { NextResponse } from "next/server";

import { WorkPublicationServiceError } from "@/lib/server/work-publication-service";
import { WorkGovernanceServiceError } from "@/lib/server/work-governance-service";
import { WorkCommunityServiceError } from "@/lib/server/work-community-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export async function workPublicationOk<T>(data: T, msg = "OK", status = 200) {
    const localizedMsg = msg === "OK" ? await serverMessage("common.ok") : await localizeErrorMessage({ message: msg });
    return NextResponse.json({ code: 0, data, msg: localizedMsg }, { status });
}

export async function workPublicationError(error: unknown, fallback: string, context: string) {
    if (error instanceof WorkPublicationServiceError || error instanceof WorkGovernanceServiceError || error instanceof WorkCommunityServiceError) {
        return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage({ message: error.message }) }, { status: error.status });
    }
    console.error(context, error);
    return NextResponse.json({ code: 500, data: null, msg: await localizeErrorMessage({ message: fallback }) }, { status: 500 });
}

export async function unauthorized() {
    return NextResponse.json({ code: 401, data: null, msg: await serverMessage("common.pleaseLogin") }, { status: 401 });
}

export async function forbidden() {
    return NextResponse.json({ code: 403, data: null, msg: await serverMessage("common.adminRequired") }, { status: 403 });
}
