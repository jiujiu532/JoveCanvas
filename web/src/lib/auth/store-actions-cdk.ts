import { randomUUID } from "node:crypto";

import { isPostgresDatabaseEnabled } from "@/lib/server/database";
import { creditPermanentPointsInAuthDb } from "@/lib/server/points-wallet-service";

import { AuthInputError } from "./store-foundation";
import { generateCdkPlainCode, hashToken, isCdkCodeExpired, normalizeCdkCode, normalizeOptionalIsoDate, normalizePoints, normalizeText, previewCdkCode, resolveCdkExpiresAt, toPublicCdkCode } from "./store-normalizers";
import { mutateAuthDb, readAuthDb, readPostgresCdkListData } from "./store-repository";
import { type CreatedCdkCode, type PublicCdkCode } from "./store-types";
import { toPublicUser } from "./store-user-projection";

export type CdkListFilter = "all" | "redeemed" | "unused" | "expired";

export type CdkListResult = {
    codes: PublicCdkCode[];
    total: number;
    page: number;
    pageSize: number;
    stats: {
        total: number;
        redeemed: number;
        unused: number;
        expired: number;
    };
};

export async function listCdkCodes(input?: { page?: number; pageSize?: number; keyword?: string; filter?: CdkListFilter }): Promise<CdkListResult> {
    const keyword = normalizeText(input?.keyword, "", 120).toLowerCase();
    const filter = input?.filter === "redeemed" || input?.filter === "unused" || input?.filter === "expired" ? input.filter : "all";
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input?.pageSize) || 20)));
    const page = Math.max(1, Math.floor(Number(input?.page) || 1));
    if (isPostgresDatabaseEnabled()) {
        const db = await readPostgresCdkListData({ page, pageSize, keyword, filter, codeHash: keyword ? hashToken(normalizeCdkCode(keyword)) : "" });
        return {
            codes: db.cdkCodes.map((code) => toPublicCdkCode(code, db, { includePlain: true })),
            total: db.total,
            page: db.page,
            pageSize: db.pageSize,
            stats: db.stats,
        };
    }
    const db = await readAuthDb();
    const allCodes = db.cdkCodes
        .filter((code) => code.status === "active" && Boolean(code.code))
        .map((code) => toPublicCdkCode(code, db, { includePlain: true }))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const stats = {
        total: allCodes.length,
        redeemed: allCodes.filter((code) => code.redeemedCount > 0).length,
        unused: allCodes.filter((code) => !isCdkCodeExpired(code) && code.redeemedCount <= 0).length,
        expired: allCodes.filter(isCdkCodeExpired).length,
    };
    const filtered = allCodes.filter((code) => {
        const matchedFilter = filter === "all" || (filter === "redeemed" && code.redeemedCount > 0) || (filter === "unused" && !isCdkCodeExpired(code) && code.redeemedCount <= 0) || (filter === "expired" && isCdkCodeExpired(code));
        if (!matchedFilter) return false;
        if (!keyword) return true;
        const redemptionsText = code.redemptions.map((item) => `${item.accountId || ""} ${item.username} ${item.displayName}`).join(" ");
        return [code.code || "", code.note, redemptionsText].some((value) => value.toLowerCase().includes(keyword));
    });
    const total = filtered.length;
    const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const start = (safePage - 1) * pageSize;
    return {
        codes: filtered.slice(start, start + pageSize),
        total,
        page: safePage,
        pageSize,
        stats,
    };
}

export async function createCdkCodes(input: { count?: number; points?: number; maxRedemptions?: number; expiresAt?: string; expiresInDays?: number; note?: string }) {
    return mutateAuthDb((db) => {
        const count = Math.max(1, Math.min(100, Math.floor(Number(input.count) || 1)));
        const points = normalizePoints(input.points, 10);
        const maxRedemptions = Math.max(1, Math.min(10000, Math.floor(Number(input.maxRedemptions) || 1)));
        const expiresAt = resolveCdkExpiresAt(input.expiresAt, input.expiresInDays);
        const note = normalizeText(input.note, "", 120);
        const now = new Date().toISOString();
        const created: CreatedCdkCode[] = [];
        for (let index = 0; index < count; index += 1) {
            let code = generateCdkPlainCode();
            let attempts = 0;
            while (db.cdkCodes.some((item) => item.codeHash === hashToken(normalizeCdkCode(code))) && attempts < 8) {
                code = generateCdkPlainCode();
                attempts += 1;
            }
            const publicCode: PublicCdkCode = {
                id: randomUUID(),
                codePreview: previewCdkCode(code),
                code,
                points,
                maxRedemptions,
                redeemedCount: 0,
                redemptions: [],
                status: "active",
                note,
                ...(expiresAt ? { expiresAt } : {}),
                createdAt: now,
                updatedAt: now,
            };
            db.cdkCodes.push({
                ...publicCode,
                codeHash: hashToken(normalizeCdkCode(code)),
                redemptions: [],
            });
            created.push({ ...publicCode, code });
        }
        return created;
    });
}

export async function updateCdkCode(id: string, patch: Partial<Pick<PublicCdkCode, "status" | "note" | "expiresAt" | "points" | "maxRedemptions">>) {
    return mutateAuthDb((db) => {
        const item = db.cdkCodes.find((code) => code.id === id);
        if (!item) throw new AuthInputError("CDK 不存在");
        if (patch.status) item.status = patch.status === "active" ? "active" : "disabled";
        if (patch.note !== undefined) item.note = normalizeText(patch.note, "", 120);
        if (patch.expiresAt !== undefined) {
            const expiresAt = normalizeOptionalIsoDate(patch.expiresAt);
            if (expiresAt) item.expiresAt = expiresAt;
            else delete item.expiresAt;
        }
        if (patch.points !== undefined) item.points = normalizePoints(patch.points, item.points);
        if (patch.maxRedemptions !== undefined) item.maxRedemptions = Math.max(item.redeemedCount, Math.min(10000, Math.max(1, Math.floor(Number(patch.maxRedemptions) || item.maxRedemptions))));
        item.updatedAt = new Date().toISOString();
        return toPublicCdkCode(item, db, { includePlain: true });
    });
}

export async function deleteCdkCode(id: string) {
    return mutateAuthDb((db) => {
        const index = db.cdkCodes.findIndex((code) => code.id === id);
        if (index < 0) throw new AuthInputError("CDK 不存在");
        db.cdkCodes.splice(index, 1);
        return { ok: true, deleted: 1 };
    });
}

export async function deleteCdkCodes(ids: string[]) {
    return mutateAuthDb((db) => {
        const deletingIds = Array.from(new Set(ids.map((id) => normalizeText(id, "", 80)).filter(Boolean)));
        if (!deletingIds.length) throw new AuthInputError("请选择要删除的 CDK");
        const before = db.cdkCodes.length;
        db.cdkCodes = db.cdkCodes.filter((code) => !deletingIds.includes(code.id));
        return { ok: true, deleted: before - db.cdkCodes.length };
    });
}

export async function redeemCdkCode(userId: string, rawCode: string) {
    return mutateAuthDb((db) => {
        const code = normalizeCdkCode(rawCode);
        if (!code) throw new AuthInputError("请输入 CDK 密钥");
        const user = db.users.find((item) => item.id === userId);
        if (!user || user.status !== "active") throw new AuthInputError("用户不可用");
        const item = db.cdkCodes.find((entry) => entry.codeHash === hashToken(code));
        if (!item || item.status !== "active") throw new AuthInputError("CDK 无效或已停用");
        if (item.expiresAt && Date.parse(item.expiresAt) <= Date.now()) throw new AuthInputError("CDK 已过期");
        if (item.redeemedCount >= item.maxRedemptions) throw new AuthInputError("CDK 已兑换完");
        if (item.redemptions.some((entry) => entry.userId === userId)) throw new AuthInputError("该 CDK 已被当前账号兑换");

        const points = normalizePoints(item.points, 0);
        const now = new Date().toISOString();
        const wallet = creditPermanentPointsInAuthDb(db, {
            userId,
            amount: points,
            description: `CDK 兑换：${item.codePreview}`,
            idempotencyKey: `cdk:${item.id}:user:${userId}`,
            type: "credit",
            now: new Date(now),
        });
        item.redemptions.push({ userId, redeemedAt: now });
        item.redeemedCount = item.redemptions.length;
        item.updatedAt = now;
        return { user: { ...toPublicUser(user, db), pointsBalance: wallet.snapshot.totalPoints }, points, cdk: toPublicCdkCode(item, db) };
    });
}
