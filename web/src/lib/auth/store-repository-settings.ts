import { ensurePostgresSchema, postgresQuery, type QueryExecutor } from "@/lib/server/database";
import { DEFAULT_ENTITLEMENT_LIMITS, DEFAULT_SETTINGS } from "./store-foundation";
import { decryptAuthSettingsSecrets, normalizeGenerationDefaults, normalizeSiteSettings, normalizeSystemChannelHealthResults } from "./store-normalizers";
import type { AnnouncementPage, AuthSettings, EntitlementPlan, PublicAnnouncement, SystemModelChannel } from "./store-types";
import { dbBool, dbIso, dbJson, dbJsonParam, dbNumber, dbOptionalIso, dbText } from "./store-repository-users";

export function mapPostgresSettings(settingsRow: Record<string, unknown> | undefined, planRows: Record<string, unknown>[], channelRows: Record<string, unknown>[]): AuthSettings {
    const fallback = DEFAULT_SETTINGS;
    return {
        site: normalizeSiteSettings(dbJson(settingsRow?.site, fallback.site)),
        registrationEnabled: dbBool(settingsRow?.registration_enabled, fallback.registrationEnabled),
        emailRegistrationEnabled: dbBool(settingsRow?.email_registration_enabled, fallback.emailRegistrationEnabled),
        freeDailyPointsEnabled: dbBool(settingsRow?.free_daily_points_enabled, fallback.freeDailyPointsEnabled),
        freeDailyPoints: dbNumber(settingsRow?.free_daily_points, fallback.freeDailyPoints),
        mail: dbJson(settingsRow?.mail, fallback.mail),
        allowUserApiConfig: dbBool(settingsRow?.allow_user_api_config, fallback.allowUserApiConfig),
        modelPointCosts: dbJson(settingsRow?.model_point_costs, fallback.modelPointCosts),
        generationPointMultipliers: dbJson(settingsRow?.generation_point_multipliers, fallback.generationPointMultipliers),
        entitlements: {
            enabled: dbBool(settingsRow?.entitlements_enabled, fallback.entitlements.enabled),
            defaultPlanId: dbText(settingsRow?.default_plan_id) || fallback.entitlements.defaultPlanId,
            plans: planRows.length
                ? planRows.map((row) => ({
                      id: dbText(row.id),
                      name: dbText(row.name),
                      enabled: dbBool(row.enabled, true),
                      dailyPoints: dbNumber(row.daily_points, 0),
                      limits: dbJson(row.limits, DEFAULT_ENTITLEMENT_LIMITS),
                      features: dbJson(row.features, []),
                  }))
                : fallback.entitlements.plans,
        },
        generationConcurrency: dbJson(settingsRow?.generation_concurrency, fallback.generationConcurrency),
        generationDefaults: normalizeGenerationDefaults(dbJson(settingsRow?.generation_defaults, fallback.generationDefaults)),
        systemChannels: channelRows.map((row) => {
            const healthResults = normalizeSystemChannelHealthResults(row.health_results);
            return {
                id: dbText(row.id),
                name: dbText(row.name),
                baseUrl: dbText(row.base_url),
                apiKey: dbText(row.api_key_ciphertext),
                apiFormat: row.api_format === "gemini" ? "gemini" : "openai",
                models: dbJson(row.models, []),
                enabled: dbBool(row.enabled, true),
                advancedConfig: dbJson(row.advanced_config, undefined),
                ...(Object.keys(healthResults).length ? { healthResults } : {}),
            };
        }),
        logicalModels: dbJson(settingsRow?.logical_models, fallback.logicalModels),
        defaultModels: dbJson(settingsRow?.default_models, fallback.defaultModels),
        agentSkills: dbJson(settingsRow?.agent_skills, fallback.agentSkills),
    };
}

export function mapPostgresAnnouncement(row: Record<string, unknown>): PublicAnnouncement {
    return {
        id: dbText(row.id),
        title: dbText(row.title),
        content: dbText(row.content),
        enabled: dbBool(row.enabled, true),
        popupHome: dbBool(row.popup_home, false),
        popupAfterLogin: dbBool(row.popup_after_login, false),
        startsAt: dbOptionalIso(row.starts_at),
        endsAt: dbOptionalIso(row.ends_at),
        createdAt: dbIso(row.created_at),
        updatedAt: dbIso(row.updated_at),
    };
}

export async function upsertPostgresEntitlementPlans(db: QueryExecutor, plans: EntitlementPlan[]) {
    for (const [index, plan] of plans.entries()) {
        await db.query(
            `
            INSERT INTO entitlement_plans (id, name, enabled, daily_points, limits, features, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                enabled = EXCLUDED.enabled,
                daily_points = EXCLUDED.daily_points,
                limits = EXCLUDED.limits,
                features = EXCLUDED.features,
                sort_order = EXCLUDED.sort_order
            `,
            [plan.id, plan.name, plan.enabled, plan.dailyPoints, dbJsonParam(plan.limits), dbJsonParam(plan.features), index],
        );
    }
}

export async function upsertPostgresSettings(db: QueryExecutor, settings: AuthSettings) {
    await db.query(
        `
        INSERT INTO app_settings (
            id, site, registration_enabled, email_registration_enabled, free_daily_points_enabled, mail, allow_user_api_config,
            model_point_costs, generation_point_multipliers, entitlements_enabled, default_plan_id, generation_concurrency, generation_defaults,
            logical_models, default_models, agent_skills, free_daily_points
        )
        VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
            site = EXCLUDED.site,
            registration_enabled = EXCLUDED.registration_enabled,
            email_registration_enabled = EXCLUDED.email_registration_enabled,
            free_daily_points_enabled = EXCLUDED.free_daily_points_enabled,
            mail = EXCLUDED.mail,
            allow_user_api_config = EXCLUDED.allow_user_api_config,
            model_point_costs = EXCLUDED.model_point_costs,
            generation_point_multipliers = EXCLUDED.generation_point_multipliers,
            entitlements_enabled = EXCLUDED.entitlements_enabled,
            default_plan_id = EXCLUDED.default_plan_id,
            generation_concurrency = EXCLUDED.generation_concurrency,
            generation_defaults = EXCLUDED.generation_defaults,
            logical_models = EXCLUDED.logical_models,
            default_models = EXCLUDED.default_models,
            agent_skills = EXCLUDED.agent_skills,
            free_daily_points = EXCLUDED.free_daily_points
        `,
        [
            dbJsonParam(settings.site),
            settings.registrationEnabled,
            settings.emailRegistrationEnabled,
            settings.freeDailyPointsEnabled,
            dbJsonParam(settings.mail),
            settings.allowUserApiConfig,
            dbJsonParam(settings.modelPointCosts),
            dbJsonParam(settings.generationPointMultipliers),
            settings.entitlements.enabled,
            settings.entitlements.defaultPlanId,
            dbJsonParam(settings.generationConcurrency),
            dbJsonParam(settings.generationDefaults),
            dbJsonParam(settings.logicalModels),
            dbJsonParam(settings.defaultModels),
            dbJsonParam(settings.agentSkills),
            settings.freeDailyPoints,
        ],
    );
}

export async function upsertPostgresSystemChannels(db: QueryExecutor, channels: SystemModelChannel[]) {
    for (const [index, channel] of channels.entries()) {
        await db.query(
            `
            INSERT INTO system_model_channels (id, name, base_url, api_key_ciphertext, api_format, models, enabled, advanced_config, health_results, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [channel.id, channel.name, channel.baseUrl, channel.apiKey, channel.apiFormat, dbJsonParam(channel.models), channel.enabled, dbJsonParam(channel.advancedConfig), dbJsonParam(channel.healthResults || {}), index],
        );
    }
}

export async function insertPostgresAnnouncements(db: QueryExecutor, announcements: PublicAnnouncement[]) {
    for (const announcement of announcements) {
        await db.query(
            `
            INSERT INTO announcements (id, title, content, enabled, popup_home, popup_after_login, starts_at, ends_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [
                announcement.id,
                announcement.title,
                announcement.content,
                announcement.enabled,
                announcement.popupHome,
                announcement.popupAfterLogin,
                announcement.startsAt || null,
                announcement.endsAt || null,
                announcement.createdAt,
                announcement.updatedAt,
            ],
        );
    }
}

export async function readPostgresAnnouncementsPage(input: { includeDisabled: boolean; page: number; pageSize: number; visibleAt?: string }, executor?: QueryExecutor): Promise<AnnouncementPage> {
    if (!executor) await ensurePostgresSchema();
    const query: QueryExecutor["query"] = executor ? executor.query.bind(executor) : postgresQuery;
    const page = Number.isSafeInteger(input.page) && input.page > 0 ? input.page : 1;
    const pageSize = Number.isSafeInteger(input.pageSize) && input.pageSize > 0 ? Math.min(100, input.pageSize) : 20;
    const visibleAt = input.visibleAt || new Date().toISOString();
    const result = await query(
        `SELECT *, count(*) OVER() AS total_count
         FROM announcements
         WHERE ($1::boolean = true OR (
             enabled = true
             AND (starts_at IS NULL OR starts_at <= $2::timestamptz)
             AND (ends_at IS NULL OR ends_at > $2::timestamptz)
         ))
         ORDER BY created_at DESC, id DESC
         LIMIT $3 OFFSET $4`,
        [input.includeDisabled, visibleAt, pageSize, (page - 1) * pageSize],
    );
    return {
        items: result.rows.map(mapPostgresAnnouncement),
        total: dbNumber(result.rows[0]?.total_count, 0),
        page,
        pageSize,
    };
}

export async function readPostgresAnnouncements(executor?: QueryExecutor) {
    return (await readPostgresAnnouncementsPage({ includeDisabled: true, page: 1, pageSize: 100 }, executor)).items;
}

export async function readPostgresAuthSettings(executor?: QueryExecutor): Promise<AuthSettings> {
    if (!executor) await ensurePostgresSchema();
    const query: QueryExecutor["query"] = executor ? executor.query.bind(executor) : postgresQuery;
    const [settingsResult, planResult, channelResult] = await Promise.all([
        query("SELECT * FROM app_settings WHERE id = 'default'"),
        query("SELECT * FROM entitlement_plans ORDER BY sort_order ASC, created_at ASC"),
        query("SELECT * FROM system_model_channels ORDER BY sort_order ASC, created_at ASC"),
    ]);
    return decryptAuthSettingsSecrets(mapPostgresSettings(settingsResult.rows[0], planResult.rows, channelResult.rows));
}
