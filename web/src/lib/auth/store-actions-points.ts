import { randomUUID } from "node:crypto";

import { inferModelCapability } from "@/lib/model-capability";
import { createPostgresRepositories, ensurePostgresSchema, isPostgresDatabaseEnabled } from "@/lib/server/database";
import { consumePoints, refundPoints, walletClock } from "@/lib/server/points-wallet-service";

import { getAuthSettings } from "./store-actions-settings";
import { AuthInputError, DEFAULT_ENTITLEMENT_PLAN_ID } from "./store-foundation";
import { buildPointRecordDescription, normalizePointAmount, resolveModelPointCost, resolveUserPlan } from "./store-normalizers";
import { readAuthDb } from "./store-repository";
import { type PointUsageKind, type PublicPointRecord, type StoredPointRecord } from "./store-types";
import { publicUserFromAuthenticatedRecord, toPublicUser } from "./store-user-projection";

export type PointRecordListResult = {
    records: PublicPointRecord[];
    total: number;
    page: number;
    pageSize: number;
};

export async function listPointRecordsPage(userId: string, input?: { page?: number; pageSize?: number; direction?: "credit" | "debit" }): Promise<PointRecordListResult> {
    const pageSize = Math.max(1, Math.min(50, Math.floor(Number(input?.pageSize) || 10)));
    const page = Math.max(1, Math.floor(Number(input?.page) || 1));
    const direction = input?.direction === "credit" || input?.direction === "debit" ? input.direction : undefined;
    if (isPostgresDatabaseEnabled()) {
        await ensurePostgresSchema();
        const result = await createPostgresRepositories().points.listRecords(userId, { page, pageSize, direction });
        return {
            records: result.items.map(toPublicPointRecord),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
        };
    }
    const db = await readAuthDb();
    const records = (db.pointRecords || [])
        .filter((record) => record.userId === userId && (!direction || (direction === "credit" ? record.amount > 0 : record.amount < 0)))
        .map(toPublicPointRecord)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const total = records.length;
    const safePage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const start = (safePage - 1) * pageSize;
    return {
        records: records.slice(start, start + pageSize),
        total,
        page: safePage,
        pageSize,
    };
}

export function toPublicPointRecord(record: StoredPointRecord): PublicPointRecord {
    return { ...record, description: displayPointRecordDescription(record) };
}

export function displayPointRecordDescription(record: StoredPointRecord) {
    const description = record.description.trim();
    const model = (record.model || "").trim();
    if (!model) return description;
    if (record.type === "consume") {
        return buildPointRecordDescription(model, legacyPointUsageKindFromModel(model), "consume");
    }
    if (record.type === "admin-adjust" && record.amount > 0) {
        return buildPointRecordDescription(model, legacyPointUsageKindFromModel(model), "refund");
    }
    return description;
}

export function legacyPointUsageKindFromModel(model: string): PointUsageKind {
    const capability = inferModelCapability(model);
    if (capability !== "text") return capability;
    return "api";
}

export async function consumeUserPoints(userId: string, model: string, amount = 1, usageKind: PointUsageKind = "api", idempotencyKey?: string) {
    const normalizedModel = model.trim();
    const db = isPostgresDatabaseEnabled() ? null : await readAuthDb();
    const user = db?.users.find((item) => item.id === userId);
    if (db && (!user || user.status !== "active")) throw new AuthInputError("用户不可用");
    const settings = db ? db.settings : await getAuthSettings();
    const multiplier = resolveModelPointCost(settings.modelPointCosts, normalizedModel, settings.logicalModels);
    const units = Math.min(1000, normalizePointAmount(amount, 1));
    const cost = normalizePointAmount(units * multiplier, 0);
    const operationKey = idempotencyKey?.trim() || `points-consume:${randomUUID()}`;
    const result = await consumePoints({
        userId,
        amount: cost,
        units,
        usageKind,
        model: normalizedModel,
        description: buildPointRecordDescription(normalizedModel, usageKind, "consume"),
        idempotencyKey: operationKey,
    });
    return {
        model: normalizedModel,
        units,
        multiplier,
        cost,
        remaining: result.snapshot.totalPoints,
        permanentRemaining: result.snapshot.permanentPoints,
        dailyRemaining: result.snapshot.dailyPoints,
        dailyExpiresAt: result.snapshot.dailyExpiresAt,
        usageKind,
        planId: result.snapshot.activePlanId || (db && user ? resolveUserPlan(db, user).id : DEFAULT_ENTITLEMENT_PLAN_ID),
        recordId: result.record.id,
        idempotencyKey: result.record.idempotencyKey,
    };
}

export async function refundUserPoints(userId: string, model: string, amount: number, usageKind: PointUsageKind = "api", units = 0, idempotencyKey?: string, sourceRecordId?: string) {
    const refund = normalizePointAmount(amount, 0);
    const sourceId = sourceRecordId?.trim();
    if (isPostgresDatabaseEnabled()) {
        const clock = walletClock();
        if (!refund && !sourceId) {
            const details = await createPostgresRepositories().users.getPublicDetails([userId], { now: clock.now.toISOString(), date: clock.date });
            const user = details[0];
            return user ? publicUserFromAuthenticatedRecord(user, clock.expiresAt) : null;
        }
        if (!sourceId) throw new AuthInputError("退款缺少原消费流水");
        const result = await refundPoints({
            userId,
            sourceRecordId: sourceId,
            idempotencyKey: idempotencyKey?.trim() || `points-refund:${sourceId}`,
            usageKind,
            units: normalizePointAmount(units, 0),
            model: model.trim(),
            description: buildPointRecordDescription(model, usageKind, "refund"),
        });
        const details = await createPostgresRepositories().users.getPublicDetails([userId], { now: clock.now.toISOString(), date: clock.date });
        const user = details[0];
        return user ? { ...publicUserFromAuthenticatedRecord(user, result.snapshot.dailyExpiresAt), pointsBalance: result.snapshot.totalPoints } : null;
    }
    const db = await readAuthDb();
    const user = db.users.find((item) => item.id === userId);
    if (!user) return null;
    if (!refund && !sourceId) return toPublicUser(user, db);

    if (!sourceId) throw new AuthInputError("退款缺少原消费流水");
    const result = await refundPoints({
        userId,
        sourceRecordId: sourceId,
        idempotencyKey: idempotencyKey?.trim() || `points-refund:${sourceId}`,
        usageKind,
        units: normalizePointAmount(units, 0),
        model: model.trim(),
        description: buildPointRecordDescription(model, usageKind, "refund"),
    });
    const nextDb = await readAuthDb();
    const nextUser = nextDb.users.find((item) => item.id === userId);
    return nextUser ? { ...toPublicUser(nextUser, nextDb), pointsBalance: result.snapshot.totalPoints } : null;
}
