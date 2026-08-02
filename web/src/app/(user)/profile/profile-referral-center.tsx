"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { App, Button, Tag } from "antd";
import { Copy, Gift, Link2, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useCopyText } from "@/hooks/use-copy-text";
import { getReferralCenter, type ReferralCenter, type ReferralRewardStatus, type ReferralRiskStatus } from "@/services/api/referrals";
import { AccountPanel, LoadingBlock, profilePrimaryButtonClass, profileSecondaryButtonClass } from "./profile-elements";

export function ProfileReferralCenter() {
    const t = useTranslations("workspace.profile.referralCenter");
    const locale = useLocale();
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [data, setData] = useState<ReferralCenter | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getReferralCenter());
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [message, t]);

    useEffect(() => {
        void load();
    }, [load]);

    if (loading && !data) return <LoadingBlock />;
    if (!data)
        return (
            <AccountPanel title={t("title")} description={t("unavailableDescription")}>
                <Button className={profileSecondaryButtonClass} icon={<RefreshCw className="size-4" />} onClick={() => void load()}>
                    {t("reload")}
                </Button>
            </AccountPanel>
        );

    const enabled = data.program.enabled;
    return (
        <div className="space-y-1.5 sm:space-y-5">
            <AccountPanel
                title={t("title")}
                description={t("description")}
                action={
                    <Button className={profileSecondaryButtonClass} icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>
                        <span className="hidden sm:inline">{t("refresh")}</span>
                    </Button>
                }
            >
                <div className="rounded-xl border border-border bg-muted/25 p-3 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Gift className="size-4" />
                                {t("myCode")}
                                <Tag className="m-0" color={enabled ? "green" : "default"}>
                                    {enabled ? t("programActive") : t("programInactive")}
                                </Tag>
                            </div>
                            <div className="mt-2 break-all text-2xl font-semibold text-foreground sm:text-3xl">{data.code}</div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("riskNote")}</p>
                        </div>
                        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                            <Button disabled={!enabled} className={profileSecondaryButtonClass} icon={<Copy className="size-4" />} onClick={() => copyText(data.code, t("codeCopied"))}>
                                {t("copyCode")}
                            </Button>
                            <Button disabled={!enabled} type="primary" className={profilePrimaryButtonClass} icon={<Link2 className="size-4" />} onClick={() => copyText(data.link, t("linkCopied"))}>
                                {t("copyLink")}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4">
                    <Metric label={t("metricClicks")} value={data.stats.clicks} />
                    <Metric label={t("metricRegistrations")} value={data.stats.registrations} />
                    <Metric label={t("metricQualified")} value={data.stats.qualified} />
                    <Metric label={t("metricSettled")} value={data.stats.settled} />
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:mt-5 sm:grid-cols-3">
                    <Rule icon={<UserPlus className="size-4" />} label={t("inviterReward")} value={t("pointsValue", { amount: data.program.inviterPoints })} />
                    <Rule
                        icon={<Gift className="size-4" />}
                        label={t("inviteeReward")}
                        value={data.program.inviteeRewardType === "coupon" ? t("inviteeCoupon") : t("pointsValue", { amount: data.program.inviteePoints })}
                    />
                    <Rule
                        icon={<ShieldCheck className="size-4" />}
                        label={t("settlementRule")}
                        value={t("settlementValue", {
                            amount: (data.program.minimumPaidCents / 100).toFixed(2),
                            days: data.program.coolingOffDays,
                        })}
                    />
                </div>
            </AccountPanel>

            <div className="grid gap-1.5 sm:gap-5 lg:grid-cols-2">
                <AccountPanel title={t("progressTitle")} description={t("progressDescription")}>
                    {data.referrals.length ? (
                        <div className="divide-y divide-border">
                            {data.referrals.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 sm:py-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-foreground">{item.inviteeName}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{formatTime(item.registeredAt, locale)}</div>
                                    </div>
                                    <Tag className="m-0" color={riskColor(item.riskStatus)}>
                                        {riskLabel(item.riskStatus, t)}
                                    </Tag>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Empty label={t("progressEmpty")} />
                    )}
                </AccountPanel>

                <AccountPanel title={t("rewardsTitle")} description={t("rewardsDescription")}>
                    {data.rewards.length ? (
                        <div className="divide-y divide-border">
                            {data.rewards.map((reward) => (
                                <div key={reward.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 first:pt-0 last:pb-0 sm:py-3">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-foreground">{reward.beneficiaryRole === "inviter" ? t("rewardInviter") : t("rewardInvitee")}</div>
                                        <div className="mt-1 truncate text-xs text-muted-foreground">
                                            {formatTime(reward.createdAt, locale)}
                                            {reward.reason ? ` · ${reward.reason}` : ""}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Tag className="m-0" color={rewardColor(reward.status)}>
                                            {rewardLabel(reward.status, t)}
                                        </Tag>
                                        <div className="mt-1 text-xs font-semibold text-foreground">{reward.rewardType === "coupon" ? t("rewardCoupon") : t("pointsValue", { amount: reward.pointsAmount })}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Empty label={t("rewardsEmpty")} />
                    )}
                </AccountPanel>
            </div>
        </div>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="text-[11px] text-muted-foreground sm:text-xs">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-foreground sm:text-xl">{value}</div>
        </div>
    );
}

function Rule({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
            <span className="mt-0.5 text-muted-foreground">{icon}</span>
            <div className="min-w-0">
                <div className="text-muted-foreground">{label}</div>
                <div className="mt-1 font-semibold text-foreground">{value}</div>
            </div>
        </div>
    );
}

function Empty({ label }: { label: string }) {
    return <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{label}</div>;
}

function riskLabel(status: ReferralRiskStatus, t: ReturnType<typeof useTranslations>) {
    return status === "clear" ? t("riskClear") : status === "review" ? t("riskReview") : status === "frozen" ? t("riskFrozen") : t("riskRejected");
}

function riskColor(status: ReferralRiskStatus) {
    return status === "clear" ? "green" : status === "review" ? "gold" : status === "frozen" ? "orange" : "red";
}

function rewardLabel(status: ReferralRewardStatus, t: ReturnType<typeof useTranslations>) {
    return status === "pending" ? t("rewardPending") : status === "settled" ? t("rewardSettled") : status === "revoked" ? t("rewardRevoked") : status === "reversal_pending" ? t("rewardReversalPending") : t("rewardRejected");
}

function rewardColor(status: ReferralRewardStatus) {
    return status === "settled" ? "green" : status === "pending" ? "gold" : status === "reversal_pending" ? "orange" : "red";
}

function formatTime(value: string, locale: string) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { hour12: false }) : "-";
}
