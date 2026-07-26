"use client";

import { Button } from "antd";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Panel, PanelHeader } from "@/components/admin/admin-panel";
import { QuotaRuleTable } from "@/components/admin/admin-quota-rules";

import type { AdminDashboardController } from "./use-admin-dashboard-controller";

export function AdminPointsSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const {
        activeSection,
        settings,
        setSettings,
        settingsLoading,
        customPointModel,
        setCustomPointModel,
        saveSettings,
        updateFreeDailyPoints,
        updateModelPointCost,
        updateGenerationPointMultiplier,
        deleteGenerationPointMultiplier,
        addCustomPointModel,
        deleteModelPointCost,
    } = controller;
    if (activeSection !== "points") return null;

    return (
        <Panel>
            <PanelHeader
                title={t("points.title")}
                description={t("points.description")}
                actions={
                    <Button
                        type="primary"
                        loading={settingsLoading}
                        icon={<Save className="size-4" />}
                        aria-label={t("points.save")}
                        title={t("points.save")}
                        onClick={() =>
                            saveSettings(
                                {
                                    freeDailyPointsEnabled: settings.freeDailyPointsEnabled,
                                    freeDailyPoints: settings.freeDailyPoints,
                                    modelPointCosts: settings.modelPointCosts,
                                    generationPointMultipliers: settings.generationPointMultipliers,
                                },
                                t("points.saved"),
                            )
                        }
                    >
                        <span className="sm:hidden">{t("common.save")}</span>
                        <span className="hidden sm:inline">{t("points.save")}</span>
                    </Button>
                }
            />
            <div className="min-w-0 p-3 sm:p-5">
                <QuotaRuleTable
                    settings={settings}
                    customModel={customPointModel}
                    onCustomModelChange={setCustomPointModel}
                    onAddCustomModel={addCustomPointModel}
                    onFreeDailyPointsEnabledChange={(freeDailyPointsEnabled) => setSettings((current) => ({ ...current, freeDailyPointsEnabled }))}
                    onFreeDailyPointsChange={updateFreeDailyPoints}
                    onModelPointCostChange={updateModelPointCost}
                    onModelPointCostDelete={deleteModelPointCost}
                    onGenerationPointMultiplierChange={updateGenerationPointMultiplier}
                    onGenerationPointMultiplierDelete={deleteGenerationPointMultiplier}
                />
            </div>
        </Panel>
    );
}
