import { createPostgresRepositories, ensurePostgresSchema, postgresQuery, type QueryExecutor } from "@/lib/server/database";
import { decryptSecretValue, encryptSecretValue } from "@/lib/server/secret-crypto";
import type { StoredCdkCode, StoredCdkRedemption, StoredDailyPlanPointWallet, StoredPointRecord, StoredQuotaUsage } from "./store-types";
import { dbDate, dbIso, dbNumber, dbOptionalIso, dbOptionalText, dbText } from "./store-repository-users";

export function mapPostgresQuotaUsage(row: Record<string, unknown>): StoredQuotaUsage {
    return {
        userId: dbText(row.user_id),
        date: dbDate(row.date),
        usageKind: row.usage_kind === "image" || row.usage_kind === "video" || row.usage_kind === "audio" || row.usage_kind === "text" ? row.usage_kind : "api",
        pointsSpent: dbNumber(row.points_spent, 0),
        units: dbNumber(row.units, 0),
        updatedAt: dbIso(row.updated_at),
    };
}

export function mapPostgresPointRecord(row: Record<string, unknown>): StoredPointRecord {
    const amount = dbNumber(row.amount, 0);
    const balanceAfter = dbNumber(row.balance_after, 0);
    return {
        id: dbText(row.id),
        userId: dbText(row.user_id),
        type: row.type === "consume" || row.type === "refund" || row.type === "credit" ? row.type : "admin-adjust",
        amount,
        balanceAfter,
        permanentAmount: row.permanent_amount === undefined ? amount : dbNumber(row.permanent_amount, 0),
        dailyAmount: dbNumber(row.daily_amount, 0),
        permanentBalanceAfter: row.permanent_balance_after === undefined ? balanceAfter : dbNumber(row.permanent_balance_after, 0),
        dailyBalanceAfter: dbNumber(row.daily_balance_after, 0),
        description: dbText(row.description),
        model: dbOptionalText(row.model),
        idempotencyKey: dbOptionalText(row.idempotency_key),
        sourceRecordId: dbOptionalText(row.source_record_id),
        sourceDate: row.source_date ? dbDate(row.source_date) : undefined,
        createdAt: dbIso(row.created_at),
    };
}

export function mapPostgresDailyPlanPointWallet(row: Record<string, unknown>): StoredDailyPlanPointWallet {
    return {
        userId: dbText(row.user_id),
        date: dbDate(row.date),
        planId: dbText(row.plan_id),
        assignmentId: dbOptionalText(row.assignment_id),
        grantedPoints: dbNumber(row.granted_points, 0),
        remainingPoints: dbNumber(row.remaining_points, 0),
        createdAt: dbIso(row.created_at),
        updatedAt: dbIso(row.updated_at),
    };
}

export function mapPostgresCdkCode(row: Record<string, unknown>, redemptions: StoredCdkRedemption[]): StoredCdkCode {
    return {
        id: dbText(row.id),
        codeHash: dbText(row.code_hash),
        code: decryptSecretValue(dbText(row.code_ciphertext)) || undefined,
        codePreview: dbText(row.code_preview),
        points: dbNumber(row.points, 10),
        maxRedemptions: Math.max(1, dbNumber(row.max_redemptions, 1)),
        redeemedCount: dbNumber(row.redeemed_count, redemptions.length),
        status: row.status === "disabled" ? "disabled" : "active",
        note: dbText(row.note),
        expiresAt: dbOptionalIso(row.expires_at),
        redemptions,
        createdAt: dbIso(row.created_at),
        updatedAt: dbIso(row.updated_at),
    };
}

export async function insertPostgresQuotaUsage(db: QueryExecutor, quotaUsage: StoredQuotaUsage[]) {
    for (const usage of quotaUsage) {
        await db.query("INSERT INTO quota_usage (user_id, date, usage_kind, points_spent, units, updated_at) VALUES ($1, $2, $3, $4, $5, $6)", [usage.userId, usage.date, usage.usageKind, usage.pointsSpent, usage.units, usage.updatedAt]);
    }
}

export async function insertPostgresPointRecords(db: QueryExecutor, records: StoredPointRecord[]) {
    for (const record of records) {
        await db.query(
            "INSERT INTO point_records (id, user_id, type, amount, balance_after, permanent_amount, daily_amount, permanent_balance_after, daily_balance_after, description, model, idempotency_key, source_record_id, source_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
            [
                record.id,
                record.userId,
                record.type,
                record.amount,
                record.balanceAfter,
                record.permanentAmount,
                record.dailyAmount,
                record.permanentBalanceAfter,
                record.dailyBalanceAfter,
                record.description,
                record.model || null,
                record.idempotencyKey || null,
                record.sourceRecordId || null,
                record.sourceDate || null,
                record.createdAt,
            ],
        );
    }
}

export async function insertPostgresDailyPlanPointWallets(db: QueryExecutor, wallets: StoredDailyPlanPointWallet[]) {
    for (const wallet of wallets) {
        await db.query("INSERT INTO daily_plan_point_wallets (user_id, date, plan_id, assignment_id, granted_points, remaining_points, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)", [
            wallet.userId,
            wallet.date,
            wallet.planId,
            wallet.assignmentId || null,
            wallet.grantedPoints,
            wallet.remainingPoints,
            wallet.createdAt,
            wallet.updatedAt,
        ]);
    }
}

export async function insertPostgresCdkCodes(db: QueryExecutor, codes: StoredCdkCode[]) {
    for (const code of codes) {
        await db.query(
            `
            INSERT INTO cdk_codes (id, code_hash, code_ciphertext, code_preview, points, max_redemptions, redeemed_count, status, note, expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `,
            [code.id, code.codeHash, encryptSecretValue(code.code || ""), code.codePreview, code.points, code.maxRedemptions, code.redemptions.length, code.status, code.note, code.expiresAt || null, code.createdAt, code.updatedAt],
        );
    }

    for (const code of codes) {
        for (const redemption of code.redemptions) {
            await db.query("INSERT INTO cdk_redemptions (cdk_code_id, user_id, redeemed_at) VALUES ($1, $2, $3)", [code.id, redemption.userId, redemption.redeemedAt]);
        }
    }
}

export async function readPostgresCdkListData(input?: { page?: number; pageSize?: number; keyword?: string; codeHash?: string; filter?: "all" | "redeemed" | "unused" | "expired" }, executor?: QueryExecutor) {
    if (!executor) await ensurePostgresSchema();
    const result = await createPostgresRepositories(executor || { query: postgresQuery }).cdk.list(input);
    const cdkCodes = result.items.map(
        (item) =>
            ({
                id: item.id,
                codeHash: item.codeHash,
                code: decryptSecretValue(item.codeCiphertext) || undefined,
                codePreview: item.codePreview,
                points: item.points,
                maxRedemptions: item.maxRedemptions,
                redeemedCount: item.redeemedCount,
                status: item.status,
                note: item.note,
                expiresAt: item.expiresAt,
                redemptions: item.redemptions.map((redemption) => ({ userId: redemption.userId, redeemedAt: redemption.redeemedAt })),
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }) satisfies StoredCdkCode,
    );
    const usersById = new Map<string, { id: string; accountId?: string; username: string; displayName: string }>();
    for (const item of result.items) {
        for (const redemption of item.redemptions) {
            const username = redemption.username || "已删除用户";
            usersById.set(redemption.userId, { id: redemption.userId, accountId: redemption.accountId, username, displayName: redemption.displayName || username });
        }
    }
    return {
        cdkCodes,
        users: [...usersById.values()],
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        stats: result.stats,
    };
}
