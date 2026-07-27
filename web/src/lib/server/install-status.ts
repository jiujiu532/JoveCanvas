import { DEFAULT_SITE_SETTINGS, getPublicUserSummary } from "@/lib/auth/store";
import { getDatabaseProvider, getPostgresConnectionString, initializePostgresSchema, postgresQuery } from "@/lib/server/database";
import { getEncryptionKeyStatus } from "@/lib/server/secret-crypto";
import type { AppLocale } from "@/i18n/locale";
import zhServer from "../../../messages/zh/server.json";
import enServer from "../../../messages/en/server.json";

export type InstallStatus = {
    provider: "file" | "postgres";
    ready: boolean;
    firstAdminRequired: boolean;
    userCount: number;
    site: typeof DEFAULT_SITE_SETTINGS;
    security: {
        encryptionReady: boolean;
        message: string;
    };
    database: {
        configured: boolean;
        healthy: boolean;
        schemaReady: boolean;
        connectionEnv: "DATABASE_URL" | "POSTGRES_URL" | null;
        message: string;
        detail?: string;
    };
};

const READY_CACHE_TTL_MS = 15_000;
const UNHEALTHY_CACHE_TTL_MS = 2_000;
const globalForInstallStatus = globalThis as typeof globalThis & {
    __vozebProInstallStatusCache?: {
        key: string;
        value?: InstallStatus;
        expiresAt: number;
        pending?: Promise<InstallStatus>;
    };
};

type InstallDict = (typeof zhServer)["install"];

function installMessage(locale: AppLocale, key: keyof InstallDict) {
    const dict = (locale === "en" ? enServer : zhServer).install as InstallDict;
    return dict[key] ?? (zhServer.install as InstallDict)[key] ?? String(key);
}

async function resolveLocale(): Promise<AppLocale> {
    try {
        const { getLocale } = await import("next-intl/server");
        const locale = await getLocale();
        return locale === "en" ? "en" : "zh";
    } catch {
        return "zh";
    }
}

export async function getInstallStatus(): Promise<InstallStatus> {
    const provider = getDatabaseProvider();
    const encryption = getEncryptionKeyStatus();
    const locale = await resolveLocale();
    const key = `${provider}:${provider === "postgres" ? getPostgresConnectionString() : ""}:${encryption.ready}:${locale}`;
    const now = Date.now();
    const cached = globalForInstallStatus.__vozebProInstallStatusCache;
    if (cached?.key === key) {
        if (cached.value && cached.expiresAt > now) return cached.value;
        if (cached.pending) return cached.pending;
    }

    const pending = loadInstallStatus(provider, encryption, locale);
    globalForInstallStatus.__vozebProInstallStatusCache = { key, expiresAt: 0, pending };
    try {
        const value = await pending;
        const ttl = value.firstAdminRequired ? 0 : value.ready ? READY_CACHE_TTL_MS : UNHEALTHY_CACHE_TTL_MS;
        globalForInstallStatus.__vozebProInstallStatusCache = { key, value: ttl ? value : undefined, expiresAt: ttl ? Date.now() + ttl : 0 };
        return value;
    } catch (error) {
        globalForInstallStatus.__vozebProInstallStatusCache = undefined;
        throw error;
    }
}

export function invalidateInstallStatusCache() {
    globalForInstallStatus.__vozebProInstallStatusCache = undefined;
}

async function loadInstallStatus(provider: "file" | "postgres", encryption = getEncryptionKeyStatus(), locale: AppLocale = "zh"): Promise<InstallStatus> {
    const t = (key: keyof InstallDict) => installMessage(locale, key);
    if (provider === "file") {
        try {
            const users = await getPublicUserSummary();
            return buildStatus({
                provider,
                userCount: users.total,
                security: { encryptionReady: encryption.ready, message: encryption.message },
                database: {
                    configured: true,
                    healthy: true,
                    schemaReady: true,
                    connectionEnv: null,
                    message: t("fileReady"),
                },
            });
        } catch (error) {
            console.error("File install status check failed", error);
            return buildStatus({
                provider,
                userCount: 0,
                security: { encryptionReady: encryption.ready, message: encryption.message },
                database: {
                    configured: true,
                    healthy: false,
                    schemaReady: false,
                    connectionEnv: null,
                    message: t("fileUnavailable"),
                    detail: t("errorInLogs"),
                },
            });
        }
    }

    const connectionEnv = postgresConnectionEnv();
    if (!getPostgresConnectionString()) {
        return buildStatus({
            provider,
            userCount: 0,
            security: { encryptionReady: encryption.ready, message: encryption.message },
            database: {
                configured: false,
                healthy: false,
                schemaReady: false,
                connectionEnv,
                message: t("pgMissingConfig"),
                detail: t("pgMissingConfigDetail"),
            },
        });
    }

    try {
        await postgresQuery("SELECT 1");
    } catch (error) {
        console.error("PostgreSQL install connection check failed", error);
        return buildStatus({
            provider,
            userCount: 0,
            security: { encryptionReady: encryption.ready, message: encryption.message },
            database: {
                configured: true,
                healthy: false,
                schemaReady: false,
                connectionEnv,
                message: t("pgConnectFailed"),
                detail: t("errorInLogs"),
            },
        });
    }

    try {
        const schema = await postgresQuery<{ table_name: string | null }>("SELECT to_regclass('public.users')::text AS table_name");
        if (!schema.rows[0]?.table_name) {
            return buildStatus({
                provider,
                userCount: 0,
                security: { encryptionReady: encryption.ready, message: encryption.message },
                database: {
                    configured: true,
                    healthy: true,
                    schemaReady: false,
                    connectionEnv,
                    message: t("pgAwaitSchema"),
                },
            });
        }
        const result = await postgresQuery<{ total: string | number }>("SELECT count(*) AS total FROM users");
        const userCount = Number(result.rows[0]?.total || 0);
        return buildStatus({
            provider,
            userCount,
            security: { encryptionReady: encryption.ready, message: encryption.message },
            database: {
                configured: true,
                healthy: true,
                schemaReady: true,
                connectionEnv,
                message: t("pgSchemaReady"),
            },
        });
    } catch (error) {
        console.error("PostgreSQL install schema check failed", error);
        return buildStatus({
            provider,
            userCount: 0,
            security: { encryptionReady: encryption.ready, message: encryption.message },
            database: {
                configured: true,
                healthy: false,
                schemaReady: false,
                connectionEnv,
                message: t("pgSchemaCheckFailed"),
                detail: t("errorInLogs"),
            },
        });
    }
}

export async function initializeInstallDatabase() {
    const locale = await resolveLocale();
    const t = (key: keyof InstallDict) => installMessage(locale, key);
    if (getDatabaseProvider() !== "postgres") throw new InstallInitializationError(t("initNotNeeded"), 409);
    if (!getPostgresConnectionString()) throw new InstallInitializationError(t("initNeedDatabaseUrl"), 400);
    if (!getEncryptionKeyStatus().ready) throw new InstallInitializationError(t("initNeedEncryptionKey"), 400);
    try {
        await initializePostgresSchema();
    } catch (error) {
        console.error("PostgreSQL install initialization failed", error);
        throw new InstallInitializationError(t("initFailed"), 500);
    }
    invalidateInstallStatusCache();
    return getInstallStatus();
}

export class InstallInitializationError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

function buildStatus(input: Omit<InstallStatus, "ready" | "firstAdminRequired" | "site">): InstallStatus {
    const runtimeReady = input.database.healthy && input.database.schemaReady && input.security.encryptionReady;
    const firstAdminRequired = runtimeReady && input.userCount === 0;
    return {
        ...input,
        ready: runtimeReady && input.userCount > 0,
        firstAdminRequired,
        site: DEFAULT_SITE_SETTINGS,
    };
}

function postgresConnectionEnv() {
    if (process.env.DATABASE_URL?.trim()) return "DATABASE_URL";
    if (process.env.POSTGRES_URL?.trim()) return "POSTGRES_URL";
    return null;
}
