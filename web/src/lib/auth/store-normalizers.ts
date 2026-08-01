import { formatAccountId, parseAccountId } from "@/lib/account-id";
import { decryptSecretValue, encryptSecretValue } from "@/lib/server/secret-crypto";
import { normalizeDefaultModelsConfig } from "@/lib/model-routing-config";

import { normalizeUserBio } from "./store-auth-utils";
import { normalizeAgentSkills } from "./store-normalizers-agent";
import {
    legacyQuotaToPoints,
    normalizeCdkCodeRecord,
    normalizeDailyPlanPointWallet,
    normalizeEntitlementSettings,
    normalizeGenerationPointMultipliers,
    normalizeModelPointCosts,
    normalizePointRecord,
    normalizeQuotaUsage,
    resolveInitialUserPoints,
    resolvePlanById,
} from "./store-normalizers-billing";
import { normalizeGenerationConcurrency, normalizeGenerationDefaults, normalizeLogicalModels, normalizeSystemChannel } from "./store-normalizers-generation";
import { normalizeAnnouncement, normalizeMailSettings, normalizeSiteSettings } from "./store-normalizers-site";
import { normalizePoints } from "./store-normalizers-shared";
import { normalizeEmailCode } from "./store-normalizers-user";
import { DEFAULT_SETTINGS } from "./store-foundation";
import type { AuthSettings, AuthDatabase, LegacyUserQuota, StoredUser } from "./store-types";

// Re-export channel helpers used by callers of store-normalizers
export { normalizeApiPath, normalizeSystemChannelAdvancedConfig, normalizeSystemChannelHealthResults, textOrEmpty } from "./store-normalizers-channel";
export { currentQuotaDate, hashToken, normalizeDisplayName, normalizeEmail, normalizeUserBio, normalizeUsername, parseSessionCookie, randomNumericCode, validateEmail, validatePassword, validateUsername } from "./store-auth-utils";

// Shared primitives
export {
    allowedText,
    looksLikeUtf8Mojibake,
    normalizeDate,
    normalizeLinkUrl,
    normalizeLogoUrl,
    normalizeOptionalIsoDate,
    normalizePlanId,
    normalizePointAmount,
    normalizePointMultiplier,
    normalizePoints,
    normalizeSecretText,
    normalizeSiteIconUrl,
    normalizeText,
    repairKnownMojibakeText,
    repairUtf8MojibakeText,
    textQualityScore,
} from "./store-normalizers-shared";

// Agent
export { normalizeAgentSkill, normalizeAgentSkills } from "./store-normalizers-agent";

// Generation / model routing
export { deriveLogicalModels, normalizeGenerationConcurrency, normalizeGenerationDefaults, normalizeLogicalModels, normalizeSystemChannel } from "./store-normalizers-generation";

// Billing / entitlements / CDK / points
export {
    addPointRecord,
    assertDailyLimit,
    assertEntitlementUsageAllowed,
    buildPointRecordDescription,
    dailyUsageLimitLabel,
    findQuotaUsage,
    formatCdkCodeForDisplay,
    generateCdkPlainCode,
    isCdkCodeExpired,
    legacyQuotaToPoints,
    normalizeCdkCode,
    normalizeCdkCodeRecord,
    normalizeDailyPlanPointWallet,
    normalizeEntitlementLimits,
    normalizeEntitlementPlan,
    normalizeEntitlementSettings,
    normalizeFeatureList,
    normalizeGenerationPointMultipliers,
    normalizeModelPointCosts,
    normalizeMultiplierMap,
    normalizePointRecord,
    normalizeQuotaUsage,
    previewCdkCode,
    recordQuotaUsage,
    resolveCdkExpiresAt,
    resolveDailyUsageLimit,
    resolveDefaultPlan,
    resolveInitialUserPoints,
    resolveModelPointCost,
    resolvePlanById,
    resolveUserPlan,
    toPublicCdkCode,
} from "./store-normalizers-billing";

// Site / mail / announcements
export { isAnnouncementVisible, normalizeAnnouncement, normalizeMailSettings, normalizeShowcaseTags, normalizeSiteFriendLinks, normalizeSiteSettings, normalizeSiteShowcaseItems, normalizeSiteSocial, normalizeSiteSocials } from "./store-normalizers-site";

// User / email codes
export { consumeEmailCode, countActiveAdmins, normalizeEmailCode } from "./store-normalizers-user";

export function normalizeDb(db: Partial<AuthDatabase>): AuthDatabase {
    const settings = normalizeSettings(decryptAuthSettingsSecrets({ ...DEFAULT_SETTINGS, ...(db.settings || {}) } as AuthSettings));
    const usedAccountIds = new Set<number>();
    let nextGeneratedAccountId = 1;
    const users = Array.isArray(db.users)
        ? db.users.map((user) => {
              const legacyUser = user as Partial<StoredUser> & { quota?: Partial<LegacyUserQuota> };
              const requestedAccountId = parseAccountId(legacyUser.accountId);
              while (usedAccountIds.has(nextGeneratedAccountId)) nextGeneratedAccountId += 1;
              const accountId = requestedAccountId && !usedAccountIds.has(requestedAccountId) ? requestedAccountId : nextGeneratedAccountId;
              usedAccountIds.add(accountId);
              nextGeneratedAccountId = Math.max(nextGeneratedAccountId, accountId + 1);
              return {
                  ...user,
                  accountId: formatAccountId(accountId),
                  bio: normalizeUserBio(legacyUser.bio),
                  planId: resolvePlanById(settings.entitlements, user.planId).id,
                  pointsBalance: normalizePoints(legacyUser.pointsBalance, legacyQuotaToPoints(legacyUser.quota, resolveInitialUserPoints({ settings } as AuthDatabase, resolvePlanById(settings.entitlements, user.planId)))),
              } as StoredUser;
          })
        : [];
    const configuredNextAccountId = parseAccountId(db.nextUserAccountId) || 1;
    return pruneExpiredSessions({
        version: 1,
        nextUserAccountId: Math.max(configuredNextAccountId, nextGeneratedAccountId),
        users,
        sessions: Array.isArray(db.sessions) ? db.sessions : [],
        quotaUsage: Array.isArray(db.quotaUsage) ? db.quotaUsage.map(normalizeQuotaUsage).filter((usage) => usage.userId) : [],
        pointRecords: Array.isArray((db as Partial<AuthDatabase>).pointRecords) ? ((db as Partial<AuthDatabase>).pointRecords || []).map(normalizePointRecord).filter((item) => item.userId) : [],
        dailyPlanPointWallets: Array.isArray(db.dailyPlanPointWallets) ? db.dailyPlanPointWallets.map(normalizeDailyPlanPointWallet).filter((item) => item.userId && item.date) : [],
        emailCodes: Array.isArray(db.emailCodes) ? db.emailCodes.map(normalizeEmailCode).filter((item) => item.email) : [],
        cdkCodes: Array.isArray(db.cdkCodes) ? db.cdkCodes.map(normalizeCdkCodeRecord).filter((item) => item.codeHash) : [],
        announcements: Array.isArray(db.announcements)
            ? db.announcements
                  .map(normalizeAnnouncement)
                  .filter((item) => item.title && item.content)
                  .slice(0, 200)
            : [],
        settings,
    });
}

export function emptyDb(): AuthDatabase {
    return { version: 1, nextUserAccountId: 1, users: [], sessions: [], quotaUsage: [], pointRecords: [], dailyPlanPointWallets: [], emailCodes: [], cdkCodes: [], announcements: [], settings: DEFAULT_SETTINGS };
}

export function encryptAuthDbSecretsForStorage(db: AuthDatabase): AuthDatabase {
    const normalized = normalizeDb(db);
    return { ...normalized, settings: encryptAuthSettingsSecrets(normalized.settings) };
}

export function decryptAuthSettingsSecrets(settings: AuthSettings): AuthSettings {
    return {
        ...settings,
        mail: { ...settings.mail, password: decryptSecretValue(settings.mail?.password || "") },
        systemChannels: Array.isArray(settings.systemChannels)
            ? settings.systemChannels.map((channel) => ({
                  ...channel,
                  apiKey: decryptSecretValue(channel.apiKey || ""),
              }))
            : [],
    };
}

export function encryptAuthSettingsSecrets(settings: AuthSettings): AuthSettings {
    return {
        ...settings,
        mail: { ...settings.mail, password: encryptSecretValue(settings.mail.password) },
        systemChannels: settings.systemChannels.map((channel) => ({
            ...channel,
            apiKey: encryptSecretValue(channel.apiKey),
        })),
    };
}

export function pruneExpiredSessions(db: AuthDatabase) {
    const now = Date.now();
    db.sessions = db.sessions.filter((session) => Date.parse(session.expiresAt) > now);
    const minQuotaUsageDate = new Date(now - 1000 * 60 * 60 * 24 * 45).toISOString().slice(0, 10);
    db.quotaUsage = db.quotaUsage.filter((usage) => usage.date >= minQuotaUsageDate);
    db.pointRecords = (db.pointRecords || []).slice(-10000);
    db.emailCodes = (db.emailCodes || []).filter((item) => !item.consumedAt && Date.parse(item.expiresAt) > now);
    db.cdkCodes = db.cdkCodes || [];
    db.announcements = (db.announcements || []).slice(0, 200);
    return db;
}

export function normalizeSettings(settings: AuthSettings): AuthSettings {
    const systemChannels = Array.isArray(settings.systemChannels) ? settings.systemChannels.map(normalizeSystemChannel).filter((channel) => channel.name || channel.baseUrl || channel.models.length) : [];
    const logicalModels = normalizeLogicalModels(settings.logicalModels, systemChannels);
    return {
        site: normalizeSiteSettings(settings.site),
        registrationEnabled: Boolean(settings.registrationEnabled),
        emailRegistrationEnabled: Boolean(settings.emailRegistrationEnabled),
        freeDailyPointsEnabled: settings.freeDailyPointsEnabled !== false,
        freeDailyPoints: normalizePoints(settings.freeDailyPoints, 0),
        mail: normalizeMailSettings(settings.mail),
        allowUserApiConfig: false,
        modelPointCosts: normalizeModelPointCosts(settings.modelPointCosts),
        generationPointMultipliers: normalizeGenerationPointMultipliers(settings.generationPointMultipliers),
        entitlements: normalizeEntitlementSettings(settings.entitlements),
        generationConcurrency: normalizeGenerationConcurrency(settings.generationConcurrency),
        generationDefaults: normalizeGenerationDefaults(settings.generationDefaults),
        systemChannels,
        logicalModels,
        defaultModels: normalizeDefaultModelsConfig(settings.defaultModels, logicalModels, systemChannels),
        agentSkills: normalizeAgentSkills(settings.agentSkills),
    };
}
