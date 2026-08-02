import { NextRequest, NextResponse } from "next/server";

import { createSession, createUser, isAuthInputError } from "@/lib/auth/store";
import { readJsonBody } from "@/lib/auth/request";
import { serializeCurrentUser, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/server/security";
import { getInstallStatus } from "@/lib/server/install-status";
import { REFERRAL_COOKIE_NAME } from "@/lib/server/referral-service";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const install = await getInstallStatus();
        if (!install.ready && !install.firstAdminRequired) return NextResponse.json({ error: await serverMessage("common.installRequired") }, { status: 503 });
        const body = await readJsonBody<{ username?: string; email?: string; emailCode?: string; displayName?: string; password?: string; referralCode?: string; referralSource?: string }>(request);
        const referralCodeProvided = Object.prototype.hasOwnProperty.call(body, "referralCode");
        const cookieReferralCode = request.cookies.get(REFERRAL_COOKIE_NAME)?.value;
        const referralCode = install.firstAdminRequired ? undefined : referralCodeProvided ? body.referralCode?.trim() || undefined : cookieReferralCode;
        const referralSource = referralCode ? body.referralSource?.trim() || (referralCodeProvided ? "registration-form" : "invite-link") : undefined;
        const registrationIdentity = String(body.username || body.email || "unknown")
            .trim()
            .toLowerCase()
            .slice(0, 160);
        const limit = await checkRateLimit(`register:${getClientIp(request)}:${registrationIdentity}`, { maxRequests: 10, windowMs: 60 * 60 * 1000 });
        if (!limit.allowed) return NextResponse.json({ error: await serverMessage("common.rateLimitedFeatureRetry", { feature: await serverMessage("features.register") }), retryAfter: Math.ceil((limit.resetAt - Date.now()) / 1000) }, { status: 429 });
        const user = await createUser({
            username: body.username || "",
            email: body.email,
            emailCode: body.emailCode,
            displayName: body.displayName,
            password: body.password || "",
            referralCode,
            referralSource,
            referralClientIp: getClientIp(request),
        });
        const sessionValue = await createSession(user.id);
        const response = NextResponse.json({ user: serializeCurrentUser(user) });
        setSessionCookie(response, sessionValue, request);
        response.cookies.set(REFERRAL_COOKIE_NAME, "", { path: "/", maxAge: 0 });
        return response;
    } catch (error) {
        return await authErrorResponse(error);
    }
}

async function authErrorResponse(error: unknown) {
    if (isAuthInputError(error)) return NextResponse.json({ error: await localizeErrorMessage(error) }, { status: error.status });
    console.error("Register failed", error);
    return NextResponse.json({ error: await serverMessage("auth.registerFailed") }, { status: 500 });
}
