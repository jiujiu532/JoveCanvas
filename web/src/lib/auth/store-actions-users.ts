import { randomUUID } from "node:crypto";

import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled, withPostgresTransaction } from "@/lib/server/database";
import { adjustPermanentPointsInAuthDb, walletClock } from "@/lib/server/points-wallet-service";

import { hashPassword } from "./password";
import { AuthInputError } from "./store-foundation";
import { consumeEmailCode, countActiveAdmins, normalizeDisplayName, normalizeEmail, normalizePoints, normalizeText, normalizeUserBio, resolvePlanById, validateEmail, validatePassword } from "./store-normalizers";
import { mutateAuthDb, readAuthDb, readPostgresPublicUserData } from "./store-repository";
import { type PublicUser, type PublicUserSummary, type UserRole, type UserStatus } from "./store-types";
import { matchesPublicUser, publicUserFromAuthenticatedRecord, summarizePublicUsers, toPublicUser } from "./store-user-projection";

export { toPublicUser };

export async function listPublicUsers() {
    if (isPostgresDatabaseEnabled()) {
        const data = await readPostgresPublicUserData(walletClock().date);
        return data.users.map((user) => toPublicUser(user, data)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    const db = await readAuthDb();
    return db.users.map((user) => toPublicUser(user, db)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export type PublicUserListResult = {
    users: PublicUser[];
    total: number;
    page: number;
    pageSize: number;
    summary: PublicUserSummary;
};

export async function listPublicUsersPage(input?: { page?: number; pageSize?: number; keyword?: string; role?: UserRole; status?: UserStatus }): Promise<PublicUserListResult> {
    const page = Math.max(1, Math.floor(Number(input?.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input?.pageSize) || 20)));
    const keyword = normalizeText(input?.keyword, "", 120).toLowerCase();
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const repos = createPostgresRepositories();
        const clock = walletClock();
        const [result, summary] = await Promise.all([repos.users.list({ page, pageSize, keyword, role: input?.role, status: input?.status }), repos.users.summarize({ now: clock.now.toISOString(), date: clock.date })]);
        const details = await repos.users.getPublicDetails(
            result.items.map((user) => user.id),
            { now: clock.now.toISOString(), date: clock.date },
        );
        const usersById = new Map(details.map((record) => [record.user.id, publicUserFromAuthenticatedRecord(record, clock.expiresAt)]));
        return {
            users: result.items.map((user) => usersById.get(user.id)).filter((user): user is PublicUser => Boolean(user)),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            summary,
        };
    }
    const db = await readAuthDb();
    const publicUsers = db.users.map((user) => toPublicUser(user, db)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const filtered = publicUsers.filter((user) => matchesPublicUser(user, { keyword, role: input?.role, status: input?.status }));
    const total = filtered.length;
    const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    return {
        users: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
        total,
        page: safePage,
        pageSize,
        summary: summarizePublicUsers(publicUsers, db.settings.entitlements.defaultPlanId),
    };
}

export async function getPublicUserSummary(): Promise<PublicUserSummary> {
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const clock = walletClock();
        return createPostgresRepositories().users.summarize({ now: clock.now.toISOString(), date: clock.date });
    }
    const db = await readAuthDb();
    return summarizePublicUsers(
        db.users.map((user) => toPublicUser(user, db)),
        db.settings.entitlements.defaultPlanId,
    );
}

export async function getPublicUsersByIds(userIds: string[]): Promise<PublicUser[]> {
    const ids = Array.from(new Set(userIds.map((id) => normalizeText(id, "", 120)).filter(Boolean)));
    if (!ids.length) return [];
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const clock = walletClock();
        const records = await createPostgresRepositories().users.getPublicDetails(ids, { now: clock.now.toISOString(), date: clock.date });
        return records.map((record) => publicUserFromAuthenticatedRecord(record, clock.expiresAt));
    }
    const db = await readAuthDb();
    const idSet = new Set(ids);
    return db.users.filter((user) => idSet.has(user.id)).map((user) => toPublicUser(user, db));
}

export async function findPublicUserIdsByKeyword(value: string, limit = 100): Promise<string[]> {
    const keyword = normalizeText(value, "", 120).toLowerCase();
    if (!keyword) return [];
    const pageSize = Math.max(1, Math.min(100, Math.floor(limit)));
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const result = await createPostgresRepositories().users.list({ page: 1, pageSize, keyword });
        return result.items.map((user) => user.id);
    }
    const db = await readAuthDb();
    return db.users
        .map((user) => toPublicUser(user, db))
        .filter((user) => matchesPublicUser(user, { keyword }))
        .slice(0, pageSize)
        .map((user) => user.id);
}

export async function updateOwnProfile(userId: string, input: { displayName?: string; bio?: string; email?: string; emailCode?: string }) {
    if (isPostgresDatabaseEnabled() && input.email === undefined) {
        await ensurePostgresSchema();
        const clock = walletClock();
        const record = await withPostgresTransaction(async (client) => {
            const users = createPostgresRepositories(client).users;
            const current = await users.getById(userId, true);
            if (!current || current.status !== "active") throw new AuthInputError("用户不可用");
            await users.update(userId, {
                displayName: input.displayName === undefined ? undefined : normalizeDisplayName(input.displayName || current.username),
                bio: input.bio === undefined ? undefined : normalizeUserBio(input.bio),
            });
            return (await users.getPublicDetails([userId], { now: clock.now.toISOString(), date: clock.date }))[0];
        });
        if (!record) throw new AuthInputError("用户不可用");
        return publicUserFromAuthenticatedRecord(record, clock.expiresAt);
    }
    return mutateAuthDb((db) => {
        const user = db.users.find((item) => item.id === userId);
        if (!user || user.status !== "active") throw new AuthInputError("用户不可用");

        if (input.displayName !== undefined) user.displayName = normalizeDisplayName(input.displayName || user.username);
        if (input.bio !== undefined) user.bio = normalizeUserBio(input.bio);

        if (input.email !== undefined) {
            const email = normalizeEmail(input.email);
            if (!email) throw new AuthInputError("请填写邮箱地址");
            validateEmail(email);
            if (email !== (user.email || "").toLowerCase()) {
                if (db.users.some((item) => item.id !== user.id && item.email?.toLowerCase() === email)) throw new AuthInputError("邮箱已被注册");
                consumeEmailCode(db, { purpose: "email-change", email, code: input.emailCode, userId });
                user.email = email;
            }
        }

        user.updatedAt = new Date().toISOString();
        return toPublicUser(user, db);
    });
}

export async function updateUserByAdmin(actorId: string, userId: string, patch: Partial<Pick<PublicUser, "displayName" | "email" | "role" | "status" | "pointsBalance" | "planId">> & { password?: string }) {
    return mutateAuthDb((db) => {
        const user = db.users.find((item) => item.id === userId);
        if (!user) throw new AuthInputError("用户不存在");
        if (user.id === actorId && patch.status === "disabled") throw new AuthInputError("不能禁用当前登录的管理员账号");

        const nextRole = patch.role || user.role;
        const nextStatus = patch.status || user.status;
        if (user.role === "admin" && nextRole !== "admin" && countActiveAdmins(db, user.id) === 0) throw new AuthInputError("至少需要保留一个管理员");
        if (user.role === "admin" && nextStatus !== "active" && countActiveAdmins(db, user.id) === 0) throw new AuthInputError("至少需要保留一个可用管理员");

        if (patch.displayName !== undefined) user.displayName = normalizeDisplayName(patch.displayName || user.username);
        if (patch.email !== undefined) {
            const email = normalizeEmail(patch.email);
            if (email) {
                validateEmail(email);
                if (db.users.some((item) => item.id !== user.id && item.email?.toLowerCase() === email)) throw new AuthInputError("邮箱已被注册");
                user.email = email;
            } else {
                user.email = undefined;
            }
        }
        if (patch.password) {
            validatePassword(patch.password);
            user.passwordHash = hashPassword(patch.password);
            db.sessions = db.sessions.filter((session) => session.userId !== user.id);
        }
        user.role = nextRole;
        if (patch.planId !== undefined) user.planId = resolvePlanById(db.settings.entitlements, patch.planId).id;
        let walletPointsBalance: number | undefined;
        if (patch.pointsBalance !== undefined) {
            const previousBalance = normalizePoints(user.pointsBalance, 0);
            const delta = normalizePoints(patch.pointsBalance, user.pointsBalance) - previousBalance;
            if (nextStatus === "active") user.status = "active";
            const wallet = adjustPermanentPointsInAuthDb(db, {
                userId: user.id,
                amount: delta,
                description: "管理员后台调整",
                idempotencyKey: `admin-adjust:${user.id}:${randomUUID()}`,
            });
            walletPointsBalance = wallet?.snapshot.totalPoints;
        }
        user.status = nextStatus;
        user.updatedAt = new Date().toISOString();
        if (user.status !== "active") db.sessions = db.sessions.filter((session) => session.userId !== user.id);
        return { ...toPublicUser(user, db), ...(walletPointsBalance === undefined ? {} : { pointsBalance: walletPointsBalance }) };
    });
}

export async function deleteUserByAdmin(actorId: string, userId: string) {
    return mutateAuthDb((db) => {
        const user = db.users.find((item) => item.id === userId);
        if (!user) throw new AuthInputError("用户不存在");
        if (user.id === actorId) throw new AuthInputError("不能删除当前登录的管理员账号");
        if (user.role === "admin" && countActiveAdmins(db, user.id) === 0) throw new AuthInputError("至少需要保留一个管理员");
        db.users = db.users.filter((item) => item.id !== user.id);
        db.sessions = db.sessions.filter((session) => session.userId !== user.id);
        db.quotaUsage = db.quotaUsage.filter((usage) => !usage || typeof usage !== "object" || (usage as { userId?: unknown }).userId !== user.id);
        db.emailCodes = db.emailCodes.filter((code) => code.userId !== user.id);
        return { ok: true };
    });
}
