"use client";

import { useMemo, useRef, useState } from "react";

import type { AgentReadiness } from "@/components/admin/admin-generation-settings";
import { uniqueList } from "@/components/admin/admin-values";
import type { AdminBillingSummary } from "@/lib/admin-billing-types";
import type { AuthSettings, PublicUserSummary } from "@/lib/auth/store";
import type { PaymentConfigSummary } from "@/lib/payment-config-types";
import type { AdminSetupSummary } from "@/lib/server/admin-setup-status";

export function useAdminSettingsState(initialSettings: AuthSettings, userSummary: PublicUserSummary, setupSummary?: AdminSetupSummary) {
    const logoInputRef = useRef<HTMLInputElement>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const [settings, setSettings] = useState(initialSettings);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [mailTestLoading, setMailTestLoading] = useState(false);
    const [mailTestTo, setMailTestTo] = useState("");
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfigSummary | null>(null);
    const [billingSummary, setBillingSummary] = useState<AdminBillingSummary | null>(null);
    const [billingSummaryLoading, setBillingSummaryLoading] = useState(false);
    const [agentReadiness, setAgentReadiness] = useState<AgentReadiness | null>(null);
    const [customPointModel, setCustomPointModel] = useState("");

    const settingsSummary = useMemo(
        () => ({
            totalChannels: settings.systemChannels.length,
            enabledChannels: settings.systemChannels.filter((channel) => channel.enabled).length,
            models: uniqueList(settings.systemChannels.flatMap((channel) => channel.models)).length,
        }),
        [settings.systemChannels],
    );
    const walletSummary = useMemo(
        () => ({
            totalBalance: userSummary.totalPointsBalance,
            enabledPlans: setupSummary?.enabledPlanProducts ?? settings.entitlements.plans.filter((plan) => plan.enabled).length,
            usersWithPlan: userSummary.usersWithPlan,
        }),
        [settings.entitlements.plans, setupSummary?.enabledPlanProducts, userSummary],
    );

    return {
        logoInputRef,
        iconInputRef,
        settings,
        setSettings,
        settingsLoading,
        setSettingsLoading,
        mailTestLoading,
        setMailTestLoading,
        mailTestTo,
        setMailTestTo,
        paymentConfig,
        setPaymentConfig,
        billingSummary,
        setBillingSummary,
        billingSummaryLoading,
        setBillingSummaryLoading,
        agentReadiness,
        setAgentReadiness,
        customPointModel,
        setCustomPointModel,
        settingsSummary,
        walletSummary,
    };
}
