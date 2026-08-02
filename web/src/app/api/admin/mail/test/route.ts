import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings, type MailSettings } from "@/lib/auth/store";
import { sendSmtpTestMail } from "@/lib/mail/smtp";
import { localizeErrorMessage, serverMessage } from "@/lib/server/server-messages";

export const runtime = "nodejs";

type MailTestBody = {
    mail?: Partial<MailSettings>;
    to?: string;
};

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: await serverMessage("common.pleaseLogin") }, { status: 401 });
    if (currentUser.role !== "admin") return NextResponse.json({ error: await serverMessage("common.adminRequired") }, { status: 403 });

    try {
        const body = await readJsonBody<MailTestBody>(request);
        const settings = await getAuthSettings();
        const mail = { ...settings.mail, ...(body.mail || {}) };
        await sendSmtpTestMail({ mail, to: body.to });
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? await localizeErrorMessage(error) : await serverMessage("admin.mailTestFailed");
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
