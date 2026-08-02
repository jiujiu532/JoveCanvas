"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, InputNumber, Modal, Pagination, Segmented, Select, Switch, Tag } from "antd";
import { RefreshCw, Save, Settings2, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AdminAccountId } from "@/components/admin/admin-user-identity";
import {
    getAdminReferralOverview,
    listAdminReferralRelationships,
    listAdminReferralRewards,
    saveAdminReferralProgram,
    settleAdminReferralRewards,
    updateAdminReferralRelationship,
    type ReferralProgram,
    type ReferralRelationship,
    type ReferralReward,
    type ReferralRewardStatus,
    type ReferralRiskStatus,
} from "@/services/api/referrals";

const PAGE_SIZE = 20;

type Overview = Awaited<ReturnType<typeof getAdminReferralOverview>>;
type ProgramForm = Omit<ReferralProgram, "minimumPaidCents"> & { minimumPaidYuan: number };
type ReferralT = ReturnType<typeof useTranslations<"admin.referrals">>;

export function ReferralRewardsPanel() {
    const t = useTranslations("admin.referrals");
    const locale = useLocale();
    const numberLocale = locale === "en" ? "en-US" : "zh-CN";
    const { message, modal } = App.useApp();
    const [form] = Form.useForm<ProgramForm>();
    const inviteeRewardType = Form.useWatch("inviteeRewardType", form);
    const [overview, setOverview] = useState<Overview | null>(null);
    const [relationships, setRelationships] = useState<ReferralRelationship[]>([]);
    const [rewards, setRewards] = useState<ReferralReward[]>([]);
    const [relationshipTotal, setRelationshipTotal] = useState(0);
    const [rewardTotal, setRewardTotal] = useState(0);
    const [relationshipPage, setRelationshipPage] = useState(1);
    const [rewardPage, setRewardPage] = useState(1);
    const [keyword, setKeyword] = useState("");
    const [submittedKeyword, setSubmittedKeyword] = useState("");
    const [riskStatus, setRiskStatus] = useState<ReferralRiskStatus | "">("");
    const [rewardStatus, setRewardStatus] = useState<ReferralRewardStatus | "">("");
    const [view, setView] = useState<"relationships" | "rewards">("relationships");
    const [loading, setLoading] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settling, setSettling] = useState(false);

    const loadOverview = useCallback(async () => {
        const data = await getAdminReferralOverview();
        setOverview(data);
        return data;
    }, []);

    const loadRelationships = useCallback(async () => {
        setListLoading(true);
        try {
            const data = await listAdminReferralRelationships({ page: relationshipPage, pageSize: PAGE_SIZE, keyword: submittedKeyword || undefined, riskStatus: riskStatus || undefined });
            setRelationships(data.items);
            setRelationshipTotal(data.total);
        } finally {
            setListLoading(false);
        }
    }, [relationshipPage, riskStatus, submittedKeyword]);

    const loadRewards = useCallback(async () => {
        setListLoading(true);
        try {
            const data = await listAdminReferralRewards({ page: rewardPage, pageSize: PAGE_SIZE, status: rewardStatus || undefined });
            setRewards(data.items);
            setRewardTotal(data.total);
        } finally {
            setListLoading(false);
        }
    }, [rewardPage, rewardStatus]);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([loadOverview(), view === "relationships" ? loadRelationships() : loadRewards()]);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [loadOverview, loadRelationships, loadRewards, message, t, view]);

    useEffect(() => {
        setLoading(true);
        void loadOverview()
            .catch((error) => message.error(error instanceof Error ? error.message : t("loadFailed")))
            .finally(() => setLoading(false));
    }, [loadOverview, message, t]);

    useEffect(() => {
        if (view !== "relationships") return;
        void loadRelationships().catch((error) => message.error(error instanceof Error ? error.message : t("loadRelationshipsFailed")));
    }, [loadRelationships, message, t, view]);

    useEffect(() => {
        if (view !== "rewards") return;
        void loadRewards().catch((error) => message.error(error instanceof Error ? error.message : t("loadRewardsFailed")));
    }, [loadRewards, message, t, view]);

    const openSettings = () => {
        if (!overview) return;
        const program = overview.program;
        form.setFieldsValue({ ...program, minimumPaidYuan: program.minimumPaidCents / 100 });
        setSettingsOpen(true);
    };

    const save = async (values: ProgramForm) => {
        setSaving(true);
        try {
            const data = await saveAdminReferralProgram({ ...values, minimumPaidCents: Math.round(Number(values.minimumPaidYuan || 0) * 100) });
            setOverview((current) => (current ? { ...current, program: data.program } : current));
            setSettingsOpen(false);
            message.success(t("saved"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const settle = async () => {
        setSettling(true);
        try {
            const result = await settleAdminReferralRewards();
            message.success(result.processed ? t("settledSummary", { processed: result.processed, settled: result.settled }) : t("settledNone"));
            await refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("settleFailed"));
        } finally {
            setSettling(false);
        }
    };

    const riskActionLabel = (next: ReferralRiskStatus) => (next === "clear" ? t("riskActionClear") : next === "rejected" ? t("riskActionReject") : t("riskActionFreeze"));

    const changeRisk = (relationship: ReferralRelationship, next: ReferralRiskStatus) => {
        const action = riskActionLabel(next);
        modal.confirm({
            title: t("riskConfirmTitle", { action }),
            content: next === "rejected" ? t("riskRejectContent") : next === "clear" ? t("riskClearContent") : t("riskFreezeContent"),
            okText: action,
            okButtonProps: next === "rejected" ? { danger: true } : undefined,
            cancelText: t("cancel"),
            onOk: async () => {
                await updateAdminReferralRelationship(relationship.id, { riskStatus: next, reason: t("riskReason", { action }) });
                message.success(t("riskUpdated", { action }));
                await Promise.all([loadOverview(), loadRelationships()]);
            },
        });
    };

    const stats = overview?.stats;
    const program = overview?.program;
    return (
        <section className="space-y-4">
            <header className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                            <UserPlus className="size-4" />
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold">{t("title")}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void refresh()}>
                        {t("refresh")}
                    </Button>
                    <Button icon={<Sparkles className="size-4" />} loading={settling} onClick={() => void settle()}>
                        {t("settleNow")}
                    </Button>
                    <Button type="primary" icon={<Settings2 className="size-4" />} disabled={!overview} onClick={openSettings}>
                        {t("configure")}
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <Metric label={t("metricClicks")} value={stats?.clicks || 0} />
                <Metric label={t("metricRegistrations")} value={stats?.registrations || 0} />
                <Metric label={t("metricQualified")} value={stats?.qualified || 0} />
                <Metric label={t("metricPending")} value={stats?.pending || 0} />
                <Metric label={t("metricSettled")} value={stats?.settled || 0} />
                <Metric label={t("metricRisky")} value={stats?.risky || 0} />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-muted-foreground" />
                            <h3 className="font-semibold">{t("currentRules")}</h3>
                            <Tag color={program?.enabled ? "green" : "default"}>{program?.enabled ? t("enabled") : t("disabled")}</Tag>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{t("rulesHint")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                        <RuleFact label={t("ruleInviter")} value={t("pointsValue", { count: program?.inviterPoints || 0 })} />
                        <RuleFact label={t("ruleInvitee")} value={program?.inviteeRewardType === "coupon" ? t("coupon") : t("pointsValue", { count: program?.inviteePoints || 0 })} />
                        <RuleFact label={t("ruleMinPaid")} value={formatMoney(program?.minimumPaidCents || 0)} />
                        <RuleFact label={t("ruleCooling")} value={t("daysValue", { count: program?.coolingOffDays || 0 })} />
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
                <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <Segmented
                        value={view}
                        options={[
                            { label: t("viewRelationships"), value: "relationships" },
                            { label: t("viewRewards"), value: "rewards" },
                        ]}
                        onChange={(value) => setView(value as typeof view)}
                    />
                    {view === "relationships" ? (
                        <div className="flex min-w-0 gap-2">
                            <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
                                <Input.Search
                                    className="w-full"
                                    allowClear
                                    value={keyword}
                                    placeholder={t("searchPlaceholder")}
                                    onChange={(event) => setKeyword(event.target.value)}
                                    onSearch={(value) => {
                                        setRelationshipPage(1);
                                        setSubmittedKeyword(value.trim());
                                    }}
                                />
                            </div>
                            <div className="w-28 shrink-0">
                                <Select
                                    className="w-full"
                                    value={riskStatus}
                                    options={[{ value: "", label: t("allStatuses") }, ...(["clear", "review", "frozen", "rejected"] as const).map((value) => ({ value, label: riskLabel(value, t) }))]}
                                    onChange={(value) => {
                                        setRelationshipPage(1);
                                        setRiskStatus(value);
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="w-32">
                            <Select
                                className="w-full"
                                value={rewardStatus}
                                options={[
                                    { value: "", label: t("allStatuses") },
                                    ...(["pending", "settled", "revoked", "rejected", "reversal_pending"] as const).map((value) => ({ value, label: rewardStatusLabel(value, t) })),
                                ]}
                                onChange={(value) => {
                                    setRewardPage(1);
                                    setRewardStatus(value);
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="divide-y divide-border">
                    {listLoading ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">{t("loading")}</div>
                    ) : view === "relationships" ? (
                        relationships.length ? (
                            relationships.map((item) => <RelationshipRow key={item.id} item={item} t={t} numberLocale={numberLocale} onRiskChange={changeRisk} />)
                        ) : (
                            <Empty label={t("emptyRelationships")} />
                        )
                    ) : rewards.length ? (
                        rewards.map((item) => <RewardRow key={item.id} item={item} t={t} numberLocale={numberLocale} />)
                    ) : (
                        <Empty label={t("emptyRewards")} />
                    )}
                </div>
                {view === "relationships" && relationshipTotal > PAGE_SIZE ? (
                    <Pagination className="p-3 sm:p-4" size="small" current={relationshipPage} pageSize={PAGE_SIZE} total={relationshipTotal} showSizeChanger={false} onChange={setRelationshipPage} />
                ) : null}
                {view === "rewards" && rewardTotal > PAGE_SIZE ? <Pagination className="p-3 sm:p-4" size="small" current={rewardPage} pageSize={PAGE_SIZE} total={rewardTotal} showSizeChanger={false} onChange={setRewardPage} /> : null}
            </div>

            <Modal
                title={t("settingsTitle")}
                open={settingsOpen}
                width={720}
                centered
                destroyOnHidden
                onCancel={() => (saving ? undefined : setSettingsOpen(false))}
                footer={[
                    <Button key="cancel" disabled={saving} onClick={() => setSettingsOpen(false)}>
                        {t("cancel")}
                    </Button>,
                    <Button key="save" type="primary" icon={<Save className="size-4" />} loading={saving} onClick={() => form.submit()}>
                        {t("saveRules")}
                    </Button>,
                ]}
            >
                <Form form={form} layout="vertical" onFinish={(values) => void save(values)}>
                    <div className="grid gap-x-3 sm:grid-cols-2">
                        <Form.Item name="enabled" label={t("featureStatus")} valuePropName="checked">
                            <Switch checkedChildren={t("switchOn")} unCheckedChildren={t("switchOff")} />
                        </Form.Item>
                        <Form.Item name="autoFreezeRisk" label={t("autoFreeze")} valuePropName="checked">
                            <Switch checkedChildren={t("autoFreezeOn")} unCheckedChildren={t("autoFreezeOff")} />
                        </Form.Item>
                        <Form.Item name="inviterPoints" label={t("inviterPoints")} rules={[{ required: true, message: t("inviterPointsRequired") }]}>
                            <InputNumber className="w-full" min={0} max={1_000_000} precision={2} />
                        </Form.Item>
                        <Form.Item name="inviteeRewardType" label={t("inviteeRewardType")} rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { value: "points", label: t("rewardPoints") },
                                    { value: "coupon", label: t("rewardCoupon") },
                                ]}
                            />
                        </Form.Item>
                        {inviteeRewardType === "coupon" ? (
                            <Form.Item name="inviteeCouponTemplateId" label={t("inviteeCoupon")} rules={[{ required: true, message: t("inviteeCouponRequired") }]}>
                                <Select showSearch optionFilterProp="label" options={(overview?.couponTemplates || []).map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }))} />
                            </Form.Item>
                        ) : (
                            <Form.Item name="inviteePoints" label={t("inviteePoints")} rules={[{ required: true, message: t("inviteePointsRequired") }]}>
                                <InputNumber className="w-full" min={0} max={1_000_000} precision={2} />
                            </Form.Item>
                        )}
                        <Form.Item name="minimumPaidYuan" label={t("minimumPaid")}>
                            <InputNumber className="w-full" min={0} max={1_000_000} precision={2} prefix="¥" />
                        </Form.Item>
                        <Form.Item name="coolingOffDays" label={t("coolingOffDays")}>
                            <InputNumber className="w-full" min={0} max={365} precision={0} />
                        </Form.Item>
                        <Form.Item name="inviterMonthlyLimit" label={t("inviterMonthlyLimit")} extra={t("unlimitedExtra")}>
                            <InputNumber className="w-full" min={0} max={100_000} precision={0} />
                        </Form.Item>
                        <Form.Item name="campaignTotalLimit" label={t("campaignTotalLimit")} extra={t("unlimitedExtra")}>
                            <InputNumber className="w-full" min={0} max={10_000_000} precision={0} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>
        </section>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-border bg-card p-3 text-card-foreground">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
        </div>
    );
}

function RuleFact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <span>{label}</span>
            <div className="mt-0.5 font-semibold text-foreground">{value}</div>
        </div>
    );
}

function RelationshipRow({
    item,
    t,
    numberLocale,
    onRiskChange,
}: {
    item: ReferralRelationship;
    t: ReferralT;
    numberLocale: string;
    onRiskChange: (item: ReferralRelationship, next: ReferralRiskStatus) => void;
}) {
    const inviter = item.inviterDisplayName || item.inviterUsername || t("userUnavailable");
    const invitee = item.inviteeDisplayName || item.inviteeUsername || t("userUnavailable");
    return (
        <article className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{inviter}</span>
                    <AdminAccountId accountId={item.inviterAccountId} />
                    <span className="text-muted-foreground">{t("inviteVerb")}</span>
                    <span className="font-semibold">{invitee}</span>
                    <AdminAccountId accountId={item.inviteeAccountId} />
                    <Tag className="m-0" color={riskColor(item.riskStatus)}>
                        {riskLabel(item.riskStatus, t)}
                    </Tag>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                    {t("inviteCodeMeta", { code: item.code || "-", time: formatTime(item.registeredAt, numberLocale), source: item.attributionSource || "-" })}
                </div>
            </div>
            <div className="flex shrink-0 gap-2">
                {item.riskStatus === "clear" ? (
                    <Button size="small" onClick={() => onRiskChange(item, "frozen")}>
                        {t("riskActionFreeze")}
                    </Button>
                ) : item.riskStatus !== "rejected" ? (
                    <Button size="small" type="primary" onClick={() => onRiskChange(item, "clear")}>
                        {t("riskActionClear")}
                    </Button>
                ) : null}
                {item.riskStatus !== "rejected" ? (
                    <Button size="small" danger onClick={() => onRiskChange(item, "rejected")}>
                        {t("riskActionReject")}
                    </Button>
                ) : null}
            </div>
        </article>
    );
}

function RewardRow({ item, t, numberLocale }: { item: ReferralReward; t: ReferralT; numberLocale: string }) {
    const name = item.beneficiaryDisplayName || item.beneficiaryUsername || t("userUnavailable");
    return (
        <article className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{name}</span>
                    <AdminAccountId accountId={item.beneficiaryAccountId} />
                    <Tag className="m-0" color={rewardStatusColor(item.status)}>
                        {rewardStatusLabel(item.status, t)}
                    </Tag>
                    <Tag className="m-0">{item.beneficiaryRole === "inviter" ? t("roleInviter") : t("roleInvitee")}</Tag>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                    {t("orderMeta", { orderId: item.triggerOrderId, time: formatTime(item.createdAt, numberLocale) })}
                    {item.reason ? ` · ${item.reason}` : ""}
                </div>
            </div>
            <div className="text-sm font-semibold">{item.rewardType === "coupon" ? t("coupon") : t("pointsValue", { count: item.pointsAmount })}</div>
        </article>
    );
}

function Empty({ label }: { label: string }) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

function riskLabel(status: ReferralRiskStatus, t: ReferralT) {
    return status === "clear" ? t("riskClear") : status === "review" ? t("riskReview") : status === "frozen" ? t("riskFrozen") : t("riskRejected");
}

function riskColor(status: ReferralRiskStatus) {
    return status === "clear" ? "green" : status === "review" ? "gold" : status === "frozen" ? "orange" : "red";
}

function rewardStatusLabel(status: ReferralRewardStatus, t: ReferralT) {
    return status === "pending" ? t("rewardPending") : status === "settled" ? t("rewardSettled") : status === "revoked" ? t("rewardRevoked") : status === "reversal_pending" ? t("rewardReversalPending") : t("rewardRejected");
}

function rewardStatusColor(status: ReferralRewardStatus) {
    return status === "settled" ? "green" : status === "pending" ? "gold" : status === "reversal_pending" ? "orange" : "red";
}

function formatMoney(cents: number) {
    return `¥${(Number(cents || 0) / 100).toFixed(2)}`;
}

function formatTime(value: string, numberLocale: string) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(numberLocale, { hour12: false }) : "-";
}
