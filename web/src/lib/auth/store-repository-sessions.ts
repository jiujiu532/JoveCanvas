import type { QueryExecutor } from "@/lib/server/database";
import type { StoredEmailCode, StoredSession } from "./store-types";
import { dbIso, dbNumber, dbOptionalIso, dbOptionalText, dbText } from "./store-repository-users";

export function mapPostgresSession(row: Record<string, unknown>): StoredSession {
    return {
        id: dbText(row.id),
        userId: dbText(row.user_id),
        tokenHash: dbText(row.token_hash),
        createdAt: dbIso(row.created_at),
        expiresAt: dbIso(row.expires_at),
    };
}

export function mapPostgresEmailCode(row: Record<string, unknown>): StoredEmailCode {
    return {
        id: dbText(row.id),
        purpose: row.purpose === "email-change" || row.purpose === "password-reset" ? row.purpose : "register",
        email: dbText(row.email),
        userId: dbOptionalText(row.user_id),
        codeHash: dbText(row.code_hash),
        createdAt: dbIso(row.created_at),
        expiresAt: dbIso(row.expires_at),
        consumedAt: dbOptionalIso(row.consumed_at),
        attempts: dbNumber(row.attempts, 0),
    };
}

export async function insertPostgresSessions(db: QueryExecutor, sessions: StoredSession[]) {
    for (const session of sessions) {
        await db.query("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)", [session.id, session.userId, session.tokenHash, session.createdAt, session.expiresAt]);
    }
}

export async function insertPostgresEmailCodes(db: QueryExecutor, emailCodes: StoredEmailCode[]) {
    for (const code of emailCodes) {
        await db.query("INSERT INTO email_codes (id, purpose, email, user_id, code_hash, created_at, expires_at, consumed_at, attempts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
            code.id,
            code.purpose,
            code.email,
            code.userId || null,
            code.codeHash,
            code.createdAt,
            code.expiresAt,
            code.consumedAt || null,
            code.attempts || 0,
        ]);
    }
}
