import { ensurePostgresSchema, isPostgresDatabaseEnabled, postgresQuery, withPostgresTransaction, type QueryExecutor } from "@/lib/server/database";
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/data-adapter";
import { lockAuthMutation } from "@/lib/server/auth-mutation-lock";
import type { AuthDatabase, StoredCdkRedemption } from "./store-types";
import { AUTH_DATA_FILE, EmailCodeAttemptError } from "./store-foundation";
import { encryptAuthDbSecretsForStorage, emptyDb, normalizeDb, pruneExpiredSessions } from "./store-normalizers";

import { insertPostgresUsers, mapPostgresUser, syncPostgresUserAccountIdSequence, dbText, dbIso } from "./store-repository-users";
import { insertPostgresAnnouncements, mapPostgresAnnouncement, mapPostgresSettings, upsertPostgresEntitlementPlans, upsertPostgresSettings, upsertPostgresSystemChannels } from "./store-repository-settings";
import { insertPostgresEmailCodes, insertPostgresSessions, mapPostgresEmailCode, mapPostgresSession } from "./store-repository-sessions";
import {
    insertPostgresCdkCodes,
    insertPostgresDailyPlanPointWallets,
    insertPostgresPointRecords,
    insertPostgresQuotaUsage,
    mapPostgresCdkCode,
    mapPostgresDailyPlanPointWallet,
    mapPostgresPointRecord,
    mapPostgresQuotaUsage,
} from "./store-repository-billing";

export let mutationQueue = Promise.resolve();

export async function readAuthDb(): Promise<AuthDatabase> {
    if (isPostgresDatabaseEnabled()) return readPostgresAuthDb();
    return normalizeDb(await readJsonDataFile<Partial<AuthDatabase>>(AUTH_DATA_FILE, emptyDb()));
}

export async function mutateAuthDb<T>(mutator: (db: AuthDatabase) => T | Promise<T>, options?: { afterPostgresPersist?: (result: T, client: QueryExecutor) => Promise<void> }) {
    const run = mutationQueue.then(async () => {
        if (isPostgresDatabaseEnabled()) {
            await ensurePostgresSchema();
            const outcome = await withPostgresTransaction(async (client) => {
                await lockAuthMutation(client);
                const db = pruneExpiredSessions(await readPostgresAuthDb(client));
                try {
                    const result = await mutator(db);
                    await writePostgresAuthDbWithExecutor(db, client);
                    if (options?.afterPostgresPersist) await options.afterPostgresPersist(result, client);
                    return { ok: true as const, result };
                } catch (error) {
                    if (!(error instanceof EmailCodeAttemptError)) throw error;
                    await writePostgresAuthDbWithExecutor(db, client);
                    return { ok: false as const, error };
                }
            });
            if (!outcome.ok) throw outcome.error;
            return outcome.result;
        }
        const db = pruneExpiredSessions(await readAuthDb());
        try {
            const result = await mutator(db);
            await writeAuthDb(db);
            return result;
        } catch (error) {
            if (error instanceof EmailCodeAttemptError) await writeAuthDb(db);
            throw error;
        }
    });
    mutationQueue = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}

export async function writeAuthDb(db: AuthDatabase) {
    if (isPostgresDatabaseEnabled()) {
        await writePostgresAuthDb(db);
        return;
    }
    await writeJsonDataFile(AUTH_DATA_FILE, encryptAuthDbSecretsForStorage(db));
}

export async function readPostgresAuthDb(executor?: QueryExecutor): Promise<AuthDatabase> {
    if (!executor) await ensurePostgresSchema();
    const query: QueryExecutor["query"] = executor ? executor.query.bind(executor) : postgresQuery;
    const [settingsResult, planResult, channelResult, userResult, sessionResult, quotaResult, pointRecordResult, dailyWalletResult, emailCodeResult, cdkResult, cdkRedemptionResult, announcementResult] = await Promise.all([
        query("SELECT * FROM app_settings WHERE id = 'default'"),
        query("SELECT * FROM entitlement_plans ORDER BY sort_order ASC, created_at ASC"),
        query("SELECT * FROM system_model_channels ORDER BY sort_order ASC, created_at ASC"),
        query("SELECT * FROM users ORDER BY created_at ASC"),
        query("SELECT * FROM sessions ORDER BY created_at ASC"),
        query("SELECT * FROM quota_usage ORDER BY date ASC"),
        query("SELECT * FROM point_records ORDER BY created_at ASC"),
        query("SELECT * FROM daily_plan_point_wallets ORDER BY date ASC"),
        query("SELECT * FROM email_codes ORDER BY created_at ASC"),
        query("SELECT * FROM cdk_codes ORDER BY created_at ASC"),
        query("SELECT * FROM cdk_redemptions ORDER BY redeemed_at ASC"),
        query("SELECT * FROM announcements ORDER BY created_at DESC"),
    ]);
    const redemptionsByCodeId = new Map<string, StoredCdkRedemption[]>();
    for (const row of cdkRedemptionResult.rows) {
        const cdkCodeId = dbText(row.cdk_code_id);
        const list = redemptionsByCodeId.get(cdkCodeId) || [];
        list.push({ userId: dbText(row.user_id), redeemedAt: dbIso(row.redeemed_at) });
        redemptionsByCodeId.set(cdkCodeId, list);
    }

    return normalizeDb({
        version: 1,
        users: userResult.rows.map(mapPostgresUser),
        sessions: sessionResult.rows.map(mapPostgresSession),
        quotaUsage: quotaResult.rows.map(mapPostgresQuotaUsage),
        pointRecords: pointRecordResult.rows.map(mapPostgresPointRecord),
        dailyPlanPointWallets: dailyWalletResult.rows.map(mapPostgresDailyPlanPointWallet),
        emailCodes: emailCodeResult.rows.map(mapPostgresEmailCode),
        cdkCodes: cdkResult.rows.map((row) => mapPostgresCdkCode(row, redemptionsByCodeId.get(dbText(row.id)) || [])),
        announcements: announcementResult.rows.map(mapPostgresAnnouncement),
        settings: mapPostgresSettings(settingsResult.rows[0], planResult.rows, channelResult.rows),
    });
}

export async function readPostgresPublicUserData(date: string, executor?: QueryExecutor) {
    if (!executor) await ensurePostgresSchema();
    const query: QueryExecutor["query"] = executor ? executor.query.bind(executor) : postgresQuery;
    const [settingsResult, planResult, userResult, dailyWalletResult] = await Promise.all([
        query("SELECT * FROM app_settings WHERE id = 'default'"),
        query("SELECT * FROM entitlement_plans ORDER BY sort_order ASC, created_at ASC"),
        query("SELECT * FROM users ORDER BY created_at DESC"),
        query("SELECT * FROM daily_plan_point_wallets WHERE date = $1", [date]),
    ]);
    return {
        users: userResult.rows.map(mapPostgresUser),
        dailyPlanPointWallets: dailyWalletResult.rows.map(mapPostgresDailyPlanPointWallet),
        settings: mapPostgresSettings(settingsResult.rows[0], planResult.rows, []),
    };
}

export async function writePostgresAuthDb(db: AuthDatabase) {
    await ensurePostgresSchema();
    await withPostgresTransaction(async (client) => writePostgresAuthDbWithExecutor(db, client));
}

export async function writePostgresAuthDbWithExecutor(db: AuthDatabase, client: QueryExecutor) {
    const normalized = encryptAuthDbSecretsForStorage(db);
    const userIds = new Set(normalized.users.map((user) => user.id));
    const cdkCodes = normalized.cdkCodes.map((code) => ({ ...code, redemptions: code.redemptions.filter((redemption) => userIds.has(redemption.userId)) }));
    await upsertPostgresEntitlementPlans(client, normalized.settings.entitlements.plans);
    await upsertPostgresSettings(client, normalized.settings);
    await client.query("DELETE FROM sessions");
    await client.query("DELETE FROM email_codes");
    await client.query("DELETE FROM quota_usage");
    await client.query("DELETE FROM point_records");
    await client.query("DELETE FROM daily_plan_point_wallets");
    await client.query("DELETE FROM cdk_redemptions");
    await client.query("DELETE FROM cdk_codes");
    await client.query("DELETE FROM announcements");
    await client.query("DELETE FROM system_model_channels");
    await client.query("DELETE FROM entitlement_plans WHERE id <> ALL($1::text[])", [normalized.settings.entitlements.plans.map((plan) => plan.id)]);

    await upsertPostgresSystemChannels(client, normalized.settings.systemChannels);
    await insertPostgresUsers(client, normalized.users);
    await client.query("DELETE FROM users WHERE id <> ALL($1::text[])", [normalized.users.map((user) => user.id)]);
    await syncPostgresUserAccountIdSequence(client);
    await insertPostgresSessions(
        client,
        normalized.sessions.filter((session) => userIds.has(session.userId)),
    );
    await insertPostgresEmailCodes(
        client,
        normalized.emailCodes.filter((code) => !code.userId || userIds.has(code.userId)),
    );
    await insertPostgresQuotaUsage(
        client,
        normalized.quotaUsage.filter((usage) => userIds.has(usage.userId)),
    );
    await insertPostgresPointRecords(
        client,
        normalized.pointRecords.filter((record) => userIds.has(record.userId)),
    );
    await insertPostgresDailyPlanPointWallets(
        client,
        normalized.dailyPlanPointWallets.filter((wallet) => userIds.has(wallet.userId)),
    );
    await insertPostgresCdkCodes(client, cdkCodes);
    await insertPostgresAnnouncements(client, normalized.announcements);
}

export * from "./store-repository-users";
export * from "./store-repository-settings";
export * from "./store-repository-sessions";
export * from "./store-repository-billing";
