import { formatAccountId } from "@/lib/account-id";
import type { QueryExecutor } from "@/lib/server/database";
import { dbOptionalText, dbText } from "@/lib/server/database/repository-utils";
import { DEFAULT_USER_POINTS } from "./store-foundation";
import type { StoredUser } from "./store-types";

export { dbOptionalText, dbText };

export function mapPostgresUser(row: Record<string, unknown>): StoredUser {
    return {
        id: dbText(row.id),
        accountId: formatAccountId(row.account_id),
        username: dbText(row.username),
        email: dbOptionalText(row.email),
        displayName: dbText(row.display_name),
        bio: dbText(row.bio),
        avatarStorageKey: dbOptionalText(row.avatar_storage_key),
        role: row.role === "admin" ? "admin" : "user",
        status: row.status === "disabled" ? "disabled" : "active",
        planId: dbText(row.plan_id),
        pointsBalance: dbNumber(row.points_balance, DEFAULT_USER_POINTS),
        passwordHash: dbText(row.password_hash),
        createdAt: dbIso(row.created_at),
        updatedAt: dbIso(row.updated_at),
        lastLoginAt: dbOptionalIso(row.last_login_at),
    };
}

export async function insertPostgresUsers(db: QueryExecutor, users: StoredUser[]) {
    for (const user of users) {
        await db.query(
            `
            INSERT INTO users (id, account_id, username, email, display_name, bio, avatar_storage_key, role, status, plan_id, points_balance, password_hash, last_login_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
                account_id = EXCLUDED.account_id,
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                bio = EXCLUDED.bio,
                avatar_storage_key = EXCLUDED.avatar_storage_key,
                role = EXCLUDED.role,
                status = EXCLUDED.status,
                plan_id = EXCLUDED.plan_id,
                points_balance = EXCLUDED.points_balance,
                password_hash = EXCLUDED.password_hash,
                last_login_at = EXCLUDED.last_login_at,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            `,
            [
                user.id,
                Number(user.accountId),
                user.username,
                user.email || null,
                user.displayName,
                user.bio,
                user.avatarStorageKey || null,
                user.role,
                user.status,
                user.planId,
                user.pointsBalance,
                user.passwordHash,
                user.lastLoginAt || null,
                user.createdAt,
                user.updatedAt,
            ],
        );
    }
}

export async function syncPostgresUserAccountIdSequence(db: QueryExecutor) {
    await db.query(`
        SELECT setval(
            'user_account_id_seq',
            greatest((SELECT last_value FROM user_account_id_seq), coalesce((SELECT max(account_id) FROM users), 1)),
            (SELECT is_called FROM user_account_id_seq) OR EXISTS (SELECT 1 FROM users)
        )
    `);
}

export function dbNumber(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function dbBool(value: unknown, fallback: boolean) {
    if (typeof value === "boolean") return value;
    return fallback;
}

export function dbIso(value: unknown) {
    const date = value instanceof Date ? value : new Date(dbText(value));
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export function dbOptionalIso(value: unknown) {
    if (!value) return undefined;
    return dbIso(value);
}

export function dbDate(value: unknown) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return dbText(value).slice(0, 10);
}

export function dbJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    return value as T;
}

export function dbJsonParam(value: unknown) {
    return value === undefined ? null : JSON.stringify(value);
}
