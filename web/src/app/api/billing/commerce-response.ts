import { NextResponse } from "next/server";

import { isBillingInputError } from "@/lib/server/billing-service";
import { localizeErrorMessage } from "@/lib/server/server-messages";

export function commerceOk<T>(data: T, status = 200) {
    return NextResponse.json({ code: 0, data, msg: "" }, { status });
}

export async function commerceError(error: unknown, fallback: string, event: string) {
    if (isBillingInputError(error)) {
        return NextResponse.json({ code: error.status, data: null, msg: await localizeErrorMessage({ message: error.message }) }, { status: error.status });
    }
    console.error(event, error);
    return NextResponse.json({ code: 500, data: null, msg: await localizeErrorMessage({ message: fallback }) }, { status: 500 });
}
