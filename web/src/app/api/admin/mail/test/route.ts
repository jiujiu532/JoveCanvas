import { NextResponse } from "next/server";

import { readJsonBody } from "@/lib/auth/request";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthSettings, type MailSettings } from "@/lib/auth/store";
import { sendSmtpTestMail } from "@/lib/mail/smtp";
import { resolveMailBrandName } from "@/lib/site-brand";

import { serverMessage } from "@/lib/server/server-messages";
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
        await sendSmtpTestMail({ mail, to: body.to, brandName: resolveMailBrandName(settings.site) });
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "测试邮件发送失败";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
