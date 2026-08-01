import { randomUUID } from "node:crypto";

import { AuthInputError, EmailCodeAttemptError } from "./store-foundation";
import { hashToken, normalizeEmail } from "./store-auth-utils";
import type { AuthDatabase, EmailCodePurpose, StoredEmailCode } from "./store-types";

export function normalizeEmailCode(value: Partial<StoredEmailCode>): StoredEmailCode {
    return {
        id: value.id || randomUUID(),
        purpose: value.purpose === "email-change" || value.purpose === "password-reset" ? value.purpose : "register",
        email: normalizeEmail(value.email),
        userId: value.userId,
        codeHash: value.codeHash || "",
        createdAt: value.createdAt || new Date().toISOString(),
        expiresAt: value.expiresAt || new Date(0).toISOString(),
        consumedAt: value.consumedAt,
        attempts: typeof value.attempts === "number" && Number.isFinite(value.attempts) ? value.attempts : undefined,
    };
}

export function consumeEmailCode(db: AuthDatabase, input: { purpose: EmailCodePurpose; email: string; code?: string; userId?: string }) {
    const code = typeof input.code === "string" ? input.code.trim() : "";
    if (!/^\d{6}$/.test(code)) throw new AuthInputError("请输入 6 位邮箱验证码");
    const email = normalizeEmail(input.email);
    const item = db.emailCodes.find((entry) => entry.purpose === input.purpose && entry.email === email && entry.userId === input.userId && !entry.consumedAt && Date.parse(entry.expiresAt) > Date.now());
    if (!item) throw new AuthInputError("邮箱验证码不正确或已过期");
    item.attempts = (item.attempts || 0) + 1;
    if (item.attempts > 5) {
        item.consumedAt = new Date().toISOString();
        throw new EmailCodeAttemptError("验证码错误次数过多，请重新获取");
    }
    if (item.codeHash !== hashToken(code)) throw new EmailCodeAttemptError("邮箱验证码不正确或已过期");
    item.consumedAt = new Date().toISOString();
}

export function countActiveAdmins(db: AuthDatabase, excludingUserId?: string) {
    return db.users.filter((user) => user.id !== excludingUserId && user.role === "admin" && user.status === "active").length;
}
