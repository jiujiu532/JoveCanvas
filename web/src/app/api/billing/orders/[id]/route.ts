import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getBillingOrderForUser, isBillingInputError } from "@/lib/server/billing-service";

import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });

    try {
        const { id } = await context.params;
        return NextResponse.json({ order: await getBillingOrderForUser(currentUser.id, id) });
    } catch (error) {
        if (isBillingInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
        console.error("Get billing order failed", error);
        return NextResponse.json({ error: await serverMessage("billing.getOrderFailed") }, { status: 500 });
    }
}
