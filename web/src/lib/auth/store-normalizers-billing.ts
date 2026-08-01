import { randomBytes, randomUUID } from "node:crypto";

import { resolveConfiguredModelPointCost } from "@/lib/model-point-cost";

import { currentQuotaDate, hashToken } from "./store-auth-utils";
import { DEFAULT_ENTITLEMENT_LIMITS, DEFAULT_ENTITLEMENT_PLAN_ID, DEFAULT_ENTITLEMENT_SETTINGS, DEFAULT_GENERATION_POINT_MULTIPLIERS, QuotaExceededError } from "./store-foundation";
import { normalizeDate, normalizeOptionalIsoDate, normalizeOptionalText, normalizePlanId, normalizePointAmount, normalizePointMultiplier, normalizePoints, normalizeText } from "./store-normalizers-shared";
import type {
    AuthDatabase,
    EntitlementPlan,
    EntitlementPlanLimits,
    EntitlementSettings,
    GenerationPointMultipliers,
    LegacyUserQuota,
    LogicalModel,
    ModelPointCosts,
    PointUsageKind,
    PublicCdkCode,
    StoredCdkCode,
    StoredDailyPlanPointWallet,
    StoredPointRecord,
    StoredQuotaUsage,
    StoredUser,
} from "./store-types";

export function resolveInitialUserPoints(db: Pick<AuthDatabase, "settings">, plan = resolveDefaultPlan(db.settings.entitlements)) {
    void db;
    void plan;
    return 0;
}

export function resolveDefaultPlan(settings: EntitlementSettings) {
    return resolvePlanById(settings, settings.defaultPlanId);
}

export function resolveUserPlan(db: Pick<AuthDatabase, "settings">, user: StoredUser) {
    return resolvePlanById(db.settings.entitlements, user.planId);
}

export function resolvePlanById(settings: EntitlementSettings, planId: unknown) {
    const id = normalizePlanId(planId);
    return settings.plans.find((plan) => plan.enabled && plan.id === id) || settings.plans.find((plan) => plan.enabled && plan.id === settings.defaultPlanId) || settings.plans.find((plan) => plan.enabled) || DEFAULT_ENTITLEMENT_SETTINGS.plans[0];
}

export function assertEntitlementUsageAllowed(db: AuthDatabase, user: StoredUser, usageKind: PointUsageKind, units: number, cost: number) {
    if (!db.settings.entitlements.enabled) return;
    const plan = resolveUserPlan(db, user);
    const usage = findQuotaUsage(db, user.id, usageKind, currentQuotaDate());
    assertDailyLimit(plan.limits.dailyPointSpend, usage.pointsSpent + cost, "今日积分消费额度");
    assertDailyLimit(resolveDailyUsageLimit(plan.limits, usageKind), usage.units + units, dailyUsageLimitLabel(usageKind));
}

export function recordQuotaUsage(db: AuthDatabase, userId: string, usageKind: PointUsageKind, unitsDelta: number, pointsDelta: number, updatedAt: string) {
    if (!db.settings.entitlements.enabled) return;
    const usage = findQuotaUsage(db, userId, usageKind, currentQuotaDate());
    usage.units = normalizePointAmount(usage.units + unitsDelta, 0);
    usage.pointsSpent = normalizePointAmount(usage.pointsSpent + pointsDelta, 0);
    usage.updatedAt = updatedAt;
}

export function findQuotaUsage(db: AuthDatabase, userId: string, usageKind: PointUsageKind, date: string) {
    const item = db.quotaUsage.find((usage) => usage.userId === userId && usage.usageKind === usageKind && usage.date === date);
    if (item) return item;
    const next: StoredQuotaUsage = { userId, usageKind, date, pointsSpent: 0, units: 0, updatedAt: new Date().toISOString() };
    db.quotaUsage.push(next);
    return next;
}

export function assertDailyLimit(limit: number, nextValue: number, label: string) {
    if (limit <= 0) return;
    if (nextValue > limit) throw new QuotaExceededError(`${label}不足，今日额度 ${limit}，本次后将达到 ${Number(nextValue.toFixed(2))}`);
}

export function resolveDailyUsageLimit(limits: EntitlementPlanLimits, usageKind: PointUsageKind) {
    if (usageKind === "image") return limits.dailyImages;
    if (usageKind === "video") return limits.dailyVideos;
    if (usageKind === "audio") return limits.dailyAudio;
    if (usageKind === "text") return limits.dailyText;
    return limits.dailyApiCalls;
}

export function dailyUsageLimitLabel(usageKind: PointUsageKind) {
    if (usageKind === "image") return "今日图片生成次数";
    if (usageKind === "video") return "今日视频生成次数";
    if (usageKind === "audio") return "今日音频生成次数";
    if (usageKind === "text") return "今日文本调用次数";
    return "今日 API 调用次数";
}

export function normalizeEntitlementSettings(settings: Partial<EntitlementSettings> | undefined): EntitlementSettings {
    const plans = Array.isArray(settings?.plans) ? settings.plans.map(normalizeEntitlementPlan).filter((plan) => plan.id) : [];
    const mergedPlans = plans.length ? plans : DEFAULT_ENTITLEMENT_SETTINGS.plans.map(normalizeEntitlementPlan);
    const defaultPlanId = normalizePlanId(settings?.defaultPlanId) || DEFAULT_ENTITLEMENT_PLAN_ID;
    const defaultPlan = mergedPlans.find((plan) => plan.id === defaultPlanId && plan.enabled) || mergedPlans.find((plan) => plan.enabled) || mergedPlans[0];
    return {
        enabled: settings?.enabled === true,
        defaultPlanId: defaultPlan.id,
        plans: mergedPlans.slice(0, 20),
    };
}

export function normalizeEntitlementPlan(plan: Partial<EntitlementPlan>): EntitlementPlan {
    const fallback = DEFAULT_ENTITLEMENT_SETTINGS.plans[0];
    return {
        id: normalizePlanId(plan.id) || fallback.id,
        name: normalizeText(plan.name, fallback.name, 40),
        enabled: plan.enabled !== false,
        dailyPoints: Math.max(0, normalizePoints(plan.dailyPoints, fallback.dailyPoints)),
        limits: normalizeEntitlementLimits(plan.limits),
        features: normalizeFeatureList(plan.features),
    };
}

export function normalizeEntitlementLimits(limits: Partial<EntitlementPlanLimits> | undefined): EntitlementPlanLimits {
    return {
        dailyPointSpend: normalizePointAmount(limits?.dailyPointSpend, DEFAULT_ENTITLEMENT_LIMITS.dailyPointSpend),
        dailyApiCalls: normalizePointAmount(limits?.dailyApiCalls, DEFAULT_ENTITLEMENT_LIMITS.dailyApiCalls),
        dailyImages: normalizePointAmount(limits?.dailyImages, DEFAULT_ENTITLEMENT_LIMITS.dailyImages),
        dailyVideos: normalizePointAmount(limits?.dailyVideos, DEFAULT_ENTITLEMENT_LIMITS.dailyVideos),
        dailyAudio: normalizePointAmount(limits?.dailyAudio, DEFAULT_ENTITLEMENT_LIMITS.dailyAudio),
        dailyText: normalizePointAmount(limits?.dailyText, DEFAULT_ENTITLEMENT_LIMITS.dailyText),
    };
}

export function normalizeFeatureList(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => normalizeText(item, "", 60)).filter(Boolean))).slice(0, 40);
}

export function normalizeModelPointCosts(value: unknown): ModelPointCosts {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([model, cost]) => [model.trim(), normalizePointMultiplier(cost)] as const)
            .filter(([model]) => Boolean(model)),
    );
}

export function normalizeGenerationPointMultipliers(value: unknown): GenerationPointMultipliers {
    const source = value && typeof value === "object" && !Array.isArray(value) ? (value as Partial<GenerationPointMultipliers>) : {};
    return {
        imageQuality: normalizeMultiplierMap(source.imageQuality, DEFAULT_GENERATION_POINT_MULTIPLIERS.imageQuality),
        videoQuality: normalizeMultiplierMap(source.videoQuality, DEFAULT_GENERATION_POINT_MULTIPLIERS.videoQuality),
        videoSeconds: normalizeMultiplierMap(source.videoSeconds, DEFAULT_GENERATION_POINT_MULTIPLIERS.videoSeconds),
    };
}

export function normalizeMultiplierMap(value: unknown, defaults: Record<string, number>) {
    const entries = value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : [];
    return {
        ...defaults,
        ...Object.fromEntries(entries.map(([key, multiplier]) => [key.trim(), normalizePointMultiplier(multiplier)] as const).filter(([key]) => Boolean(key))),
    };
}

export function resolveModelPointCost(costs: ModelPointCosts, model: string, logicalModels: LogicalModel[] = []) {
    return resolveConfiguredModelPointCost(costs, model, logicalModels);
}

export function buildPointRecordDescription(model: string, usageKind: PointUsageKind, action: "consume" | "refund") {
    const modelName = model.trim() || "默认模型";
    const actionLabels: Record<PointUsageKind, { consume: string; refund: string }> = {
        api: { consume: "模型调用扣除", refund: "模型调用失败退回" },
        image: { consume: "生成图片调用扣除", refund: "生成图片调用失败退回" },
        video: { consume: "生成视频调用扣除", refund: "生成视频调用失败退回" },
        audio: { consume: "生成音频调用扣除", refund: "生成音频调用失败退回" },
        text: { consume: "生成文本调用扣除", refund: "生成文本调用失败退回" },
    };
    return `${modelName} ${actionLabels[usageKind]?.[action] || actionLabels.api[action]}`;
}

export function legacyQuotaToPoints(quota: Partial<LegacyUserQuota> | undefined, fallback: number) {
    if (!quota || typeof quota !== "object") return fallback;
    return normalizePoints(quota.imageDaily, fallback);
}

export function normalizeQuotaUsage(value: Partial<StoredQuotaUsage>): StoredQuotaUsage {
    const usageKind: PointUsageKind = value.usageKind === "image" || value.usageKind === "video" || value.usageKind === "audio" || value.usageKind === "text" ? value.usageKind : "api";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value.date || "") ? value.date! : currentQuotaDate();
    return {
        userId: value.userId || "",
        date,
        usageKind,
        pointsSpent: normalizePointAmount(value.pointsSpent, 0),
        units: normalizePointAmount(value.units, 0),
        updatedAt: value.updatedAt || new Date().toISOString(),
    };
}

export function toPublicCdkCode(code: StoredCdkCode, db?: { users: Array<Pick<StoredUser, "id" | "username" | "displayName"> & Partial<Pick<StoredUser, "accountId">>> }, options?: { includePlain?: boolean }): PublicCdkCode {
    return {
        id: code.id,
        codePreview: code.codePreview,
        ...(options?.includePlain && code.code ? { code: code.code } : {}),
        points: code.points,
        maxRedemptions: code.maxRedemptions,
        redeemedCount: code.redeemedCount,
        redemptions: (code.redemptions || []).map((redemption) => {
            const user = db?.users.find((item) => item.id === redemption.userId);
            return {
                userId: redemption.userId,
                accountId: user?.accountId,
                username: user?.username || "已删除用户",
                displayName: user?.displayName || user?.username || "已删除用户",
                redeemedAt: redemption.redeemedAt,
            };
        }),
        status: code.status,
        note: code.note,
        expiresAt: code.expiresAt,
        createdAt: code.createdAt,
        updatedAt: code.updatedAt,
    };
}

export function isCdkCodeExpired(code: PublicCdkCode) {
    return Boolean(code.expiresAt && Date.parse(code.expiresAt) <= Date.now());
}

export function normalizeCdkCodeRecord(value: Partial<StoredCdkCode>): StoredCdkCode {
    const redemptions = Array.isArray(value.redemptions)
        ? value.redemptions
              .map((item) => ({
                  userId: typeof item?.userId === "string" ? item.userId : "",
                  redeemedAt: typeof item?.redeemedAt === "string" ? item.redeemedAt : new Date().toISOString(),
              }))
              .filter((item) => item.userId)
        : [];
    const plainCode = formatCdkCodeForDisplay(value.code || "");
    const codePreview = normalizeText(value.codePreview || (plainCode ? previewCdkCode(plainCode) : ""), "CDK-****", 40);
    const codeHash = typeof value.codeHash === "string" && value.codeHash ? value.codeHash : plainCode ? hashToken(normalizeCdkCode(plainCode)) : "";
    const now = new Date().toISOString();
    return {
        id: value.id || randomUUID(),
        codePreview,
        ...(plainCode ? { code: plainCode } : {}),
        points: normalizePoints(value.points, 10),
        maxRedemptions: Math.max(redemptions.length || 1, Math.min(10000, Math.floor(Number(value.maxRedemptions) || 1))),
        redeemedCount: redemptions.length,
        status: value.status === "disabled" ? "disabled" : "active",
        note: normalizeText(value.note, "", 120),
        codeHash,
        redemptions,
        ...(normalizeOptionalIsoDate(value.expiresAt) ? { expiresAt: normalizeOptionalIsoDate(value.expiresAt) } : {}),
        createdAt: value.createdAt || now,
        updatedAt: value.updatedAt || value.createdAt || now,
    };
}

export function normalizeCdkCode(value: string) {
    return value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

export function generateCdkPlainCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const chars = Array.from(randomBytes(20), (byte) => alphabet[byte % alphabet.length]).join("");
    return `VZ-${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10, 15)}-${chars.slice(15, 20)}`;
}

export function formatCdkCodeForDisplay(value: string) {
    const code = normalizeCdkCode(value);
    if (!code) return "";
    if (code.startsWith("VZ") && code.length === 22) return `${code.slice(0, 2)}-${code.slice(2, 7)}-${code.slice(7, 12)}-${code.slice(12, 17)}-${code.slice(17, 22)}`;
    return code;
}

export function previewCdkCode(value: string) {
    const code = normalizeCdkCode(value);
    if (code.length <= 8) return `${code.slice(0, 2)}****`;
    return `${code.slice(0, 4)}****${code.slice(-4)}`;
}

export function resolveCdkExpiresAt(expiresAt: unknown, expiresInDays: unknown) {
    const explicitDate = normalizeOptionalIsoDate(expiresAt);
    if (explicitDate) return explicitDate;
    const days = Math.floor(Number(expiresInDays));
    if (!Number.isFinite(days) || days <= 0) return undefined;
    return new Date(Date.now() + Math.min(days, 3650) * 24 * 60 * 60 * 1000).toISOString();
}

export function normalizePointRecord(value: Partial<StoredPointRecord>): StoredPointRecord {
    const type = value.type === "consume" || value.type === "refund" || value.type === "credit" ? value.type : "admin-adjust";
    const amount = Number.isFinite(Number(value.amount)) ? Number(value.amount) : 0;
    const balanceAfter = normalizePoints(value.balanceAfter, 0);
    const permanentAmount = Number.isFinite(Number(value.permanentAmount)) ? Number(value.permanentAmount) : amount;
    const dailyAmount = Number.isFinite(Number(value.dailyAmount)) ? Number(value.dailyAmount) : 0;
    return {
        id: value.id || randomUUID(),
        userId: value.userId || "",
        type,
        amount,
        balanceAfter,
        permanentAmount,
        dailyAmount,
        permanentBalanceAfter: normalizePoints(value.permanentBalanceAfter, balanceAfter),
        dailyBalanceAfter: Math.max(0, normalizePoints(value.dailyBalanceAfter, 0)),
        description: normalizeText(value.description, type === "consume" ? "积分消耗" : "积分增加", 120),
        model: typeof value.model === "string" ? value.model.slice(0, 160) : undefined,
        idempotencyKey: normalizeOptionalText(value.idempotencyKey, 200),
        sourceRecordId: normalizeOptionalText(value.sourceRecordId, 120),
        sourceDate: normalizeDate(value.sourceDate) || undefined,
        createdAt: value.createdAt || new Date().toISOString(),
    };
}

export function normalizeDailyPlanPointWallet(value: Partial<StoredDailyPlanPointWallet>): StoredDailyPlanPointWallet {
    const now = new Date().toISOString();
    const grantedPoints = Math.max(0, normalizePoints(value.grantedPoints, 0));
    return {
        userId: value.userId || "",
        date: normalizeDate(value.date),
        planId: normalizePlanId(value.planId) || DEFAULT_ENTITLEMENT_PLAN_ID,
        assignmentId: normalizeOptionalText(value.assignmentId, 120),
        grantedPoints,
        remainingPoints: Math.min(grantedPoints, Math.max(0, normalizePoints(value.remainingPoints, grantedPoints))),
        createdAt: value.createdAt || now,
        updatedAt: value.updatedAt || now,
    };
}

type PointRecordInput = Omit<StoredPointRecord, "id" | "permanentAmount" | "dailyAmount" | "permanentBalanceAfter" | "dailyBalanceAfter"> &
    Partial<Pick<StoredPointRecord, "permanentAmount" | "dailyAmount" | "permanentBalanceAfter" | "dailyBalanceAfter">>;

export function addPointRecord(db: AuthDatabase, record: PointRecordInput) {
    db.pointRecords = db.pointRecords || [];
    db.pointRecords.push(normalizePointRecord({ id: randomUUID(), ...record }));
}
