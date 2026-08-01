import { randomBytes, randomUUID } from "node:crypto";

import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled, withPostgresTransaction } from "@/lib/server/database";
import { walletClock } from "@/lib/server/points-wallet-service";

import { hashPassword, verifyPassword } from "./password";
import { AuthInputError, SESSION_MAX_AGE_SECONDS } from "./store-foundation";
import { consumeEmailCode, hashToken, normalizeEmail, parseSessionCookie, validateEmail, validatePassword } from "./store-normalizers";
import { mutateAuthDb, readAuthDb } from "./store-repository";
import { publicUserFromAuthenticatedRecord, toPublicUser } from "./store-user-projection";

export { authenticateUser, createEmailVerificationCode, createUser, createUserByAdmin } from "./store-user-access";

export function sessionMaxAgeSeconds() {
    return SESSION_MAX_AGE_SECONDS;
}

export async function updateOwnPassword(userId: string, input: { currentPassword: string; newPassword: string }) {
    return mutateAuthDb((db) => {
        const user = db.users.find((item) => item.id === userId);
        if (!user || user.status !== "active") throw new AuthInputError("用户不可用");
        if (!verifyPassword(input.currentPassword, user.passwordHash)) throw new AuthInputError("当前密码不正确");
        validatePassword(input.newPassword);
        user.passwordHash = hashPassword(input.newPassword);
        user.updatedAt = new Date().toISOString();
        db.sessions = db.sessions.filter((session) => session.userId !== user.id);
        return toPublicUser(user, db);
    });
}

export async function verifyUserPasswordForSensitiveAction(userId: string, password: string) {
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const user = await createPostgresRepositories().users.getById(userId);
        if (!user || user.status !== "active") throw new AuthInputError("用户不可用");
        if (!verifyPassword(password, user.passwordHash)) throw new AuthInputError("当前密码不正确");
        return;
    }
    const db = await readAuthDb();
    const user = db.users.find((item) => item.id === userId);
    if (!user || user.status !== "active") throw new AuthInputError("用户不可用");
    if (!verifyPassword(password, user.passwordHash)) throw new AuthInputError("当前密码不正确");
}

export async function resetPasswordByEmail(input: { email: string; code?: string; newPassword: string }) {
    return mutateAuthDb((db) => {
        const email = normalizeEmail(input.email);
        validateEmail(email);
        const user = db.users.find((item) => item.email?.toLowerCase() === email);
        if (!user || user.status !== "active") throw new AuthInputError("没有找到可用账号");
        consumeEmailCode(db, { purpose: "password-reset", email, code: input.code });
        validatePassword(input.newPassword);
        user.passwordHash = hashPassword(input.newPassword);
        user.updatedAt = new Date().toISOString();
        db.sessions = db.sessions.filter((session) => session.userId !== user.id);
        return toPublicUser(user, db);
    });
}

export async function createSession(userId: string) {
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const now = new Date();
        const sessionId = randomUUID();
        const token = randomBytes(32).toString("base64url");
        await withPostgresTransaction(async (client) => {
            const repos = createPostgresRepositories(client);
            const user = await repos.users.getById(userId, true);
            if (!user || user.status !== "active") throw new AuthInputError("用户不可用");
            await repos.sessions.pruneExpired(now);
            await repos.sessions.create({
                id: sessionId,
                userId,
                tokenHash: hashToken(token),
                createdAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
            });
        });
        return `${sessionId}.${token}`;
    }
    return mutateAuthDb((db) => {
        const user = db.users.find((item) => item.id === userId);
        if (!user || user.status !== "active") throw new AuthInputError("用户不可用");

        const now = new Date();
        const sessionId = randomUUID();
        const token = randomBytes(32).toString("base64url");
        db.sessions.push({
            id: sessionId,
            userId,
            tokenHash: hashToken(token),
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
        });
        return `${sessionId}.${token}`;
    });
}

export async function getUserBySession(cookieValue: string | undefined) {
    const sessionParts = parseSessionCookie(cookieValue);
    if (!sessionParts) return null;

    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const clock = walletClock();
        const snapshot = await createPostgresRepositories().sessions.getAuthenticatedUser({
            sessionId: sessionParts.id,
            tokenHash: hashToken(sessionParts.token),
            now: clock.now.toISOString(),
            date: clock.date,
        });
        if (!snapshot) return null;
        return publicUserFromAuthenticatedRecord(snapshot, clock.expiresAt);
    }

    const db = await readAuthDb();
    const session = db.sessions.find((item) => item.id === sessionParts.id);
    if (!session || session.tokenHash !== hashToken(sessionParts.token) || Date.parse(session.expiresAt) <= Date.now()) return null;
    const user = db.users.find((item) => item.id === session.userId);
    if (!user || user.status !== "active") return null;
    return toPublicUser(user, db);
}

export async function deleteSession(cookieValue: string | undefined) {
    const sessionParts = parseSessionCookie(cookieValue);
    if (!sessionParts) return;
    await mutateAuthDb((db) => {
        db.sessions = db.sessions.filter((item) => item.id !== sessionParts.id);
    });
}
