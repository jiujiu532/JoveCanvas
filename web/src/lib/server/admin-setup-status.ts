import { getAuthSettings, getPublicUserSummary, type AuthSettings, type PublicUserSummary } from "@/lib/auth/store";
import { listBillingProducts } from "@/lib/server/billing-service";
import { getDatabaseProvider, getPostgresConnectionString, type BillingProductRecord } from "@/lib/server/database";
import { getPaymentConfigSummary, hasPaymentProductionSecret } from "@/lib/server/payment-config-status";
import { channelConnectionReady } from "@/lib/channel-protocol-registry";
import type { AppLocale } from "@/i18n/locale";
import zhAdmin from "../../../messages/zh/admin.json";
import enAdmin from "../../../messages/en/admin.json";

export type AdminSetupStepStatus = "done" | "attention" | "pending";
export type AdminSetupAccent = "blue" | "emerald" | "amber" | "rose" | "violet" | "slate";

type AdminSetupStep = {
    id: string;
    title: string;
    eyebrow: string;
    status: AdminSetupStepStatus;
    statusLabel: string;
    description: string;
    href: string;
    actionLabel: string;
    accent: AdminSetupAccent;
    facts: string[];
};

export type AdminSetupSummary = {
    completed: number;
    total: number;
    percent: number;
    users: number;
    admins: number;
    enabledChannels: number;
    enabledProducts: number;
    enabledPlanProducts: number;
    databaseProvider: "file" | "postgres";
    steps: AdminSetupStep[];
};

type SetupDict = (typeof zhAdmin)["setup"]["steps"];

function interpolate(template: string, params?: Record<string, string | number>) {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in params ? String(params[name]) : matched));
}

function setupMessage(locale: AppLocale, key: string, params?: Record<string, string | number>) {
    const dict = (locale === "en" ? enAdmin : zhAdmin).setup.steps as SetupDict;
    const parts = key.split(".");
    let current: unknown = dict;
    for (const part of parts) {
        if (typeof current !== "object" || current === null) return key;
        current = (current as Record<string, unknown>)[part];
    }
    if (typeof current !== "string") return key;
    return interpolate(current, params);
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

export async function getAdminSetupSummary(input?: { settings?: AuthSettings; userSummary?: PublicUserSummary }) {
    const [settings, userSummary, products, locale] = await Promise.all([
        input?.settings ? Promise.resolve(input.settings) : getAuthSettings(),
        input?.userSummary ? Promise.resolve(input.userSummary) : getPublicUserSummary(),
        getBillingProductsSafe(),
        resolveLocale(),
    ]);
    const paymentConfig = await getPaymentConfigSummary();
    return buildAdminSetupSummary({ settings, userSummary, products, paymentConfig, locale });
}

function buildAdminSetupSummary(input: { settings: AuthSettings; userSummary: PublicUserSummary; products?: BillingProductRecord[]; paymentConfig: Awaited<ReturnType<typeof getPaymentConfigSummary>>; locale: AppLocale }): AdminSetupSummary {
    const { settings, userSummary, locale } = input;
    const t = (key: string, params?: Record<string, string | number>) => setupMessage(locale, key, params);
    const products = input.products || [];
    const admins = userSummary.activeAdmins;
    const enabledChannels = settings.systemChannels.filter((channel) => channel.enabled && channelConnectionReady(channel)).length;
    const enabledProducts = products.filter((product) => product.enabled).length;
    const enabledPlanProducts = countEnabledPlanProducts(products);
    const paymentConfig = input.paymentConfig;
    const paymentProviders = paymentConfig.providers.filter((provider) => provider.ready && provider.id !== "manual").map((provider) => provider.name);
    const databaseProvider = getDatabaseProvider();
    const hasPostgres = databaseProvider === "postgres" && Boolean(getPostgresConnectionString());
    const siteReady = Boolean(settings.site.title.trim() && settings.site.logoUrl.trim() && settings.site.seoTitle.trim() && settings.site.seoDescription.trim() && settings.site.termsUrl.trim() && settings.site.privacyUrl.trim());
    const channelModels = new Set(settings.systemChannels.flatMap((channel) => channel.models).filter(Boolean));
    const channelReady = enabledChannels > 0 && channelModels.size > 0;
    const defaultModelsReady = Boolean(settings.defaultModels.textModel || settings.defaultModels.imageModel || settings.defaultModels.videoModel);
    const enabledPlans = settings.entitlements.plans.filter((plan) => plan.enabled);
    const plansReady = settings.entitlements.enabled && enabledPlans.length >= 2 && enabledProducts > 0;
    const mailReady = Boolean(settings.mail.host.trim() && settings.mail.username.trim() && settings.mail.password.trim());
    const encryptionReady = hasProductionSecret(process.env.VOZEB_PRO_ENCRYPTION_KEY);

    const steps: AdminSetupStep[] = [
        {
            id: "site",
            title: t("site.title"),
            eyebrow: t("site.eyebrow"),
            status: siteReady ? "done" : "pending",
            statusLabel: siteReady ? t("site.statusDone") : t("site.statusPending"),
            description: siteReady ? t("site.descDone") : t("site.descPending"),
            href: "/admin?section=site",
            actionLabel: t("site.action"),
            accent: "blue",
            facts: [settings.site.title || t("site.factTitleUnset"), settings.site.logoUrl ? t("site.factLogoSet") : t("site.factLogoUnset"), settings.site.seoDescription ? t("site.factSeoSet") : t("site.factSeoUnset")],
        },
        {
            id: "models",
            title: t("models.title"),
            eyebrow: t("models.eyebrow"),
            status: channelReady && defaultModelsReady ? "done" : enabledChannels > 0 ? "attention" : "pending",
            statusLabel: channelReady && defaultModelsReady ? t("models.statusReady") : enabledChannels > 0 ? t("models.statusAttention") : t("models.statusPending"),
            description: enabledChannels > 0 ? t("models.descReady") : t("models.descPending"),
            href: "/admin?section=channels",
            actionLabel: t("models.action"),
            accent: "emerald",
            facts: [t("models.factChannels", { count: enabledChannels }), t("models.factModels", { count: channelModels.size }), defaultModelsReady ? t("models.factDefaultSet") : t("models.factDefaultUnset")],
        },
        {
            id: "plans",
            title: t("plans.title"),
            eyebrow: t("plans.eyebrow"),
            status: plansReady ? "done" : enabledPlans.length >= 2 || enabledProducts > 0 ? "attention" : "pending",
            statusLabel: plansReady ? t("plans.statusReady") : t("plans.statusPending"),
            description: plansReady ? t("plans.descReady") : t("plans.descPending"),
            href: "/admin?section=products",
            actionLabel: t("plans.action"),
            accent: "violet",
            facts: [settings.entitlements.enabled ? t("plans.factEntitlementsOn") : t("plans.factEntitlementsOff"), t("plans.factPlans", { count: enabledPlans.length }), t("plans.factProducts", { count: enabledPlanProducts })],
        },
        {
            id: "payments",
            title: t("payments.title"),
            eyebrow: t("payments.eyebrow"),
            status: paymentProviders.length > 0 ? "done" : "attention",
            statusLabel: paymentProviders.length > 0 ? t("payments.statusReady") : t("payments.statusManual"),
            description: paymentProviders.length > 0 ? t("payments.descReady") : t("payments.descPending"),
            href: "/admin?section=payments",
            actionLabel: t("payments.action"),
            accent: "amber",
            facts: [
                t("payments.factProviders", { count: paymentProviders.length }),
                paymentProviders.length ? paymentProviders.join(" / ") : t("payments.factProvidersPending"),
                hasPaymentProductionSecret(process.env.VOZEB_PRO_PAYMENT_WEBHOOK_SECRET) ? t("payments.factWebhookSet") : t("payments.factWebhookUnset"),
            ],
        },
        {
            id: "mail",
            title: t("mail.title"),
            eyebrow: t("mail.eyebrow"),
            status: mailReady && encryptionReady ? "done" : mailReady || encryptionReady ? "attention" : "pending",
            statusLabel: mailReady && encryptionReady ? t("mail.statusDone") : t("mail.statusPending"),
            description: mailReady && encryptionReady ? t("mail.descDone") : t("mail.descPending"),
            href: "/admin?section=settings",
            actionLabel: t("mail.action"),
            accent: "rose",
            facts: [mailReady ? t("mail.factSmtpSet") : t("mail.factSmtpUnset"), encryptionReady ? t("mail.factKeySet") : t("mail.factKeyUnset"), settings.emailRegistrationEnabled ? t("mail.factEmailRegOn") : t("mail.factEmailRegOff")],
        },
        {
            id: "storage",
            title: t("storage.title"),
            eyebrow: t("storage.eyebrow"),
            status: hasPostgres ? "done" : "attention",
            statusLabel: hasPostgres ? t("storage.statusReady") : t("storage.statusFile"),
            description: hasPostgres ? t("storage.descReady") : t("storage.descPending"),
            href: "/admin?section=settings",
            actionLabel: t("storage.action"),
            accent: "slate",
            facts: [hasPostgres ? t("storage.factPg") : t("storage.factFile"), t("storage.factMediaLocal"), t("storage.factTempCleanup"), t("storage.factLongTerm")],
        },
    ];
    const completed = steps.filter((step) => step.status === "done").length;
    return {
        completed,
        total: steps.length,
        percent: Math.round((completed / steps.length) * 100),
        users: userSummary.total,
        admins,
        enabledChannels,
        enabledProducts,
        enabledPlanProducts,
        databaseProvider,
        steps,
    };
}

export function countEnabledPlanProducts(products: BillingProductRecord[]) {
    return products.filter((product) => product.enabled && product.productKind === "plan").length;
}

async function getBillingProductsSafe() {
    try {
        return await listBillingProducts(true);
    } catch {
        return [];
    }
}

function hasProductionSecret(value: string | undefined) {
    const text = value?.trim() || "";
    return Boolean(text && !/replace-with|change-me|your-|example|local-dev/i.test(text));
}
