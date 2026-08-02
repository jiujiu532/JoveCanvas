"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Pagination, Select, Switch, Tag } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { Gift, Pencil, Plus, RefreshCw, Save, Send, TicketPercent, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AdminUserSearchSelect } from "@/components/admin/admin-user-identity";
import type { BillingProduct, CouponTemplate } from "@/services/api/billing";
import { adminProductLabel, createAdminCouponTemplate, deleteAdminCouponTemplate, grantAdminCoupon, listAdminCouponTemplates, type CouponTemplateInput, updateAdminCouponTemplate } from "@/services/api/admin-billing-commerce";

const PAGE_SIZE = 12;

type CouponFormValue = {
    code: string;
    name: string;
    description: string;
    discountType: "fixed" | "percentage";
    discountValue: number;
    minimumAmountYuan: number;
    maximumDiscountYuan: number;
    stackWithPromotion: boolean;
    claimable: boolean;
    enabled: boolean;
    range: [Dayjs, Dayjs];
    totalLimit: number;
    perUserLimit: number;
    productIds: string[];
};

type CouponT = ReturnType<typeof useTranslations<"admin.billingOps.coupons">>;

export function CouponTemplatePanel({ products, productsLoading }: { products: BillingProduct[]; productsLoading: boolean }) {
    const t = useTranslations("admin.billingOps.coupons");
    const locale = useLocale();
    const numberLocale = locale === "en" ? "en-US" : "zh-CN";
    const { message, modal } = App.useApp();
    const [form] = Form.useForm<CouponFormValue>();
    const [grantForm] = Form.useForm<{ userId: string; templateId: string }>();
    const [templates, setTemplates] = useState<CouponTemplate[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [granting, setGranting] = useState(false);
    const [deletingId, setDeletingId] = useState("");
    const [editing, setEditing] = useState<CouponTemplate | null>(null);
    const [open, setOpen] = useState(false);
    const [grantOpen, setGrantOpen] = useState(false);
    const discountType = Form.useWatch("discountType", form) || "fixed";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await listAdminCouponTemplates(page, PAGE_SIZE);
            setTemplates(result.templates);
            setTotal(result.total);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("loadFailed"));
        } finally {
            setLoading(false);
        }
    }, [message, page, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const showCreate = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({
            code: "",
            name: "",
            description: "",
            discountType: "fixed",
            discountValue: 10,
            minimumAmountYuan: 0,
            maximumDiscountYuan: 0,
            stackWithPromotion: false,
            claimable: true,
            enabled: true,
            range: [dayjs(), dayjs().add(30, "day")],
            totalLimit: 0,
            perUserLimit: 1,
            productIds: [],
        });
        setOpen(true);
    };

    const showEdit = (template: CouponTemplate) => {
        setEditing(template);
        form.setFieldsValue({
            code: template.code,
            name: template.name,
            description: template.description,
            discountType: template.discountType,
            discountValue: template.discountType === "fixed" ? template.discountValue / 100 : template.discountValue / 100,
            minimumAmountYuan: template.minimumAmountCents / 100,
            maximumDiscountYuan: template.maximumDiscountCents / 100,
            stackWithPromotion: template.stackWithPromotion,
            claimable: template.claimable,
            enabled: template.enabled,
            range: [dayjs(template.startsAt), dayjs(template.endsAt)],
            totalLimit: template.totalLimit,
            perUserLimit: template.perUserLimit,
            productIds: template.productIds,
        });
        setOpen(true);
    };

    const save = async (value: CouponFormValue) => {
        setSaving(true);
        try {
            const input: CouponTemplateInput = {
                code: value.code.trim().toUpperCase(),
                name: value.name.trim(),
                description: value.description?.trim() || "",
                discountType: value.discountType,
                discountValue: Math.round(Number(value.discountValue || 0) * 100),
                minimumAmountCents: Math.round(Number(value.minimumAmountYuan || 0) * 100),
                maximumDiscountCents: Math.round(Number(value.maximumDiscountYuan || 0) * 100),
                stackWithPromotion: value.stackWithPromotion,
                claimable: value.claimable,
                enabled: value.enabled,
                startsAt: value.range[0].toISOString(),
                endsAt: value.range[1].toISOString(),
                totalLimit: value.totalLimit,
                perUserLimit: value.perUserLimit,
                productIds: value.productIds || [],
            };
            if (editing) await updateAdminCouponTemplate(editing.id, input);
            else await createAdminCouponTemplate(input);
            message.success(editing ? t("updated") : t("created"));
            setOpen(false);
            setEditing(null);
            form.resetFields();
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const grant = async (value: { userId: string; templateId: string }) => {
        setGranting(true);
        try {
            await grantAdminCoupon({ userId: value.userId.trim(), templateId: value.templateId });
            message.success(t("granted"));
            setGrantOpen(false);
            grantForm.resetFields();
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("grantFailed"));
        } finally {
            setGranting(false);
        }
    };

    const remove = (template: CouponTemplate) => {
        modal.confirm({
            title: t("deleteTitle", { name: template.name }),
            content: t("deleteContent"),
            okText: t("deleteConfirm"),
            cancelText: t("cancel"),
            okButtonProps: { danger: true },
            onOk: async () => {
                setDeletingId(template.id);
                try {
                    await deleteAdminCouponTemplate(template.id);
                    message.success(t("deleted"));
                    if (templates.length === 1 && page > 1) setPage((current) => current - 1);
                    else await load();
                } catch (error) {
                    message.error(error instanceof Error ? error.message : t("deleteFailed"));
                    throw error;
                } finally {
                    setDeletingId("");
                }
            },
        });
    };

    return (
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-3 sm:items-center sm:p-4 dark:border-stone-800">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">{t("title")}</h2>
                    <p className="mt-1 text-xs leading-5 text-stone-500 sm:text-sm dark:text-stone-400">{t("description")}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button icon={<Send className="size-4" />} disabled={!templates.length} onClick={() => setGrantOpen(true)}>
                        <span className="hidden sm:inline">{t("grantTargeted")}</span>
                    </Button>
                    <Button icon={<RefreshCw className="size-4" />} loading={loading} aria-label={t("refreshAria")} title={t("refreshAria")} onClick={() => void load()} />
                    <Button type="primary" icon={<Plus className="size-4" />} disabled={productsLoading} onClick={showCreate}>
                        <span className="hidden sm:inline">{t("create")}</span>
                        <span className="sm:hidden">{t("createShort")}</span>
                    </Button>
                </div>
            </div>

            <div className="grid min-w-0 gap-2 p-3 sm:gap-3 sm:p-4 lg:grid-cols-2">
                {loading && !templates.length ? (
                    <Loading label={t("loading")} />
                ) : templates.length ? (
                    templates.map((template) => {
                        const state = templateState(template, t);
                        return (
                            <article key={template.id} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-900/40 sm:p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <TicketPercent className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                                            <h3 className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{template.name}</h3>
                                            <Tag className="m-0" color={state.color}>
                                                {state.label}
                                            </Tag>
                                        </div>
                                        <div className="mt-2 font-mono text-xs text-stone-500 dark:text-stone-400">{template.code}</div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-lg font-semibold tabular-nums text-stone-950 dark:text-stone-100">{discountLabel(template, numberLocale)}</div>
                                        <div className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">{template.minimumAmountCents ? t("minSpend", { amount: formatYuan(template.minimumAmountCents, numberLocale) }) : t("noMinSpend")}</div>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 border-y border-stone-200 py-3 text-center dark:border-stone-800">
                                    <Fact label={t("factIssued")} value={`${template.issuedCount}${template.totalLimit ? ` / ${template.totalLimit}` : ""}`} />
                                    <Fact label={t("factRedeemed")} value={String(template.redeemedCount)} />
                                    <Fact label={t("factPerUser")} value={t("perUserCount", { count: template.perUserLimit })} />
                                </div>
                                <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
                                    <Tag className="m-0">{template.productIds.length ? t("productsCount", { count: template.productIds.length }) : t("allProducts")}</Tag>
                                    <Tag className="m-0" color={template.stackWithPromotion ? "green" : "default"}>
                                        {template.stackWithPromotion ? t("stackable") : t("notStackable")}
                                    </Tag>
                                    <Tag className="m-0" color={template.claimable ? "blue" : "default"}>
                                        {template.claimable ? t("claimOpen") : t("claimAdminOnly")}
                                    </Tag>
                                </div>
                                {template.productIds.length ? (
                                    <p className="mt-2 truncate text-xs text-stone-500 dark:text-stone-400">{t("applicable", { list: template.productIds.map((id) => adminProductLabel(products, id)).join(t("listJoin")) })}</p>
                                ) : null}
                                <div className="mt-3 flex justify-end gap-2 border-t border-stone-200 pt-3 dark:border-stone-800">
                                    <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => showEdit(template)}>
                                        {t("edit")}
                                    </Button>
                                    <Button danger size="small" icon={<Trash2 className="size-3.5" />} loading={deletingId === template.id} onClick={() => remove(template)}>
                                        {t("delete")}
                                    </Button>
                                </div>
                            </article>
                        );
                    })
                ) : (
                    <Empty label={t("empty")} />
                )}
            </div>
            {total > PAGE_SIZE ? <Pagination className="px-3 pb-4 sm:px-4" size="small" current={page} pageSize={PAGE_SIZE} total={total} showSizeChanger={false} onChange={setPage} /> : null}

            <Modal
                title={editing ? t("editTitle") : t("createTitle")}
                open={open}
                width={820}
                centered
                destroyOnHidden
                onCancel={() => (saving ? undefined : setOpen(false))}
                styles={{ body: { maxHeight: "min(72dvh, 720px)", overflowY: "auto", paddingTop: 8 } }}
                footer={[
                    <Button key="cancel" disabled={saving} onClick={() => setOpen(false)}>
                        {t("cancel")}
                    </Button>,
                    <Button key="save" type="primary" icon={<Save className="size-4" />} loading={saving} onClick={() => form.submit()}>
                        {t("save")}
                    </Button>,
                ]}
            >
                <Form form={form} layout="vertical" onFinish={(value) => void save(value)}>
                    {editing?.issuedCount ? (
                        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">{t("issuedLockedHint")}</div>
                    ) : null}
                    <div className="grid gap-x-3 sm:grid-cols-2">
                        <Form.Item name="name" label={t("name")} rules={[{ required: true, message: t("nameRequired") }]}>
                            <Input maxLength={80} placeholder={t("namePlaceholder")} />
                        </Form.Item>
                        <Form.Item name="code" label={t("code")} rules={[{ required: true, message: t("codeRequired") }]}>
                            <Input disabled={Boolean(editing?.issuedCount)} maxLength={40} placeholder={t("codePlaceholder")} />
                        </Form.Item>
                    </div>
                    <Form.Item name="description" label={t("descriptionLabel")}>
                        <Input.TextArea rows={2} maxLength={300} placeholder={t("descriptionPlaceholder")} />
                    </Form.Item>
                    <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Form.Item name="discountType" label={t("discountType")}>
                            <Select
                                disabled={Boolean(editing?.issuedCount)}
                                options={[
                                    { label: t("discountFixed"), value: "fixed" },
                                    { label: t("discountPercentage"), value: "percentage" },
                                ]}
                            />
                        </Form.Item>
                        <Form.Item name="discountValue" label={discountType === "fixed" ? t("discountAmount") : t("discountRate")} rules={[{ required: true, message: t("discountValueRequired") }]}>
                            <InputNumber
                                disabled={Boolean(editing?.issuedCount)}
                                className="w-full"
                                min={0.01}
                                max={discountType === "fixed" ? 1_000_000 : 100}
                                precision={2}
                                prefix={discountType === "fixed" ? "¥" : undefined}
                                suffix={discountType === "percentage" ? "%" : undefined}
                            />
                        </Form.Item>
                        <Form.Item name="minimumAmountYuan" label={t("minimumAmount")}>
                            <InputNumber disabled={Boolean(editing?.issuedCount)} className="w-full" min={0} precision={2} prefix="¥" />
                        </Form.Item>
                        <Form.Item name="maximumDiscountYuan" label={t("maximumDiscount")} extra={t("maximumDiscountExtra")}>
                            <InputNumber disabled={Boolean(editing?.issuedCount)} className="w-full" min={0} precision={2} prefix="¥" />
                        </Form.Item>
                    </div>
                    <Form.Item name="range" label={t("validity")} rules={[{ required: true, message: t("validityRequired") }]}>
                        <DatePicker.RangePicker disabled={Boolean(editing?.issuedCount)} className="w-full" showTime />
                    </Form.Item>
                    <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Form.Item name="totalLimit" label={t("totalLimit")} extra={t("totalLimitExtra")}>
                            <InputNumber className="w-full" min={editing?.issuedCount || 0} precision={0} />
                        </Form.Item>
                        <Form.Item name="perUserLimit" label={t("perUserLimit")}>
                            <InputNumber disabled={Boolean(editing?.issuedCount)} className="w-full" min={1} max={100} precision={0} />
                        </Form.Item>
                        <Form.Item name="productIds" label={t("productIds")} extra={t("productIdsExtra")}>
                            <Select disabled={Boolean(editing?.issuedCount)} mode="multiple" optionFilterProp="label" options={products.map((product) => ({ value: product.id, label: product.name }))} />
                        </Form.Item>
                    </div>
                    <div className="grid gap-x-3 sm:grid-cols-3">
                        <Form.Item name="stackWithPromotion" label={t("stackWithPromotion")} valuePropName="checked">
                            <Switch disabled={Boolean(editing?.issuedCount)} checkedChildren={t("allow")} unCheckedChildren={t("disallow")} />
                        </Form.Item>
                        <Form.Item name="claimable" label={t("claimable")} valuePropName="checked">
                            <Switch checkedChildren={t("allow")} unCheckedChildren={t("claimableOff")} />
                        </Form.Item>
                        <Form.Item name="enabled" label={t("templateStatus")} valuePropName="checked">
                            <Switch checkedChildren={t("enabled")} unCheckedChildren={t("disabled")} />
                        </Form.Item>
                    </div>
                </Form>
            </Modal>

            <Modal
                title={t("grantTitle")}
                open={grantOpen}
                width={520}
                centered
                destroyOnHidden
                onCancel={() => (granting ? undefined : setGrantOpen(false))}
                footer={[
                    <Button key="cancel" disabled={granting} onClick={() => setGrantOpen(false)}>
                        {t("cancel")}
                    </Button>,
                    <Button key="grant" type="primary" icon={<Gift className="size-4" />} loading={granting} onClick={() => grantForm.submit()}>
                        {t("grantConfirm")}
                    </Button>,
                ]}
            >
                <Form form={grantForm} layout="vertical" onFinish={(value) => void grant(value)}>
                    <Form.Item name="userId" label={t("grantUser")} extra={t("grantUserExtra")} rules={[{ required: true, message: t("grantUserRequired") }]}>
                        <AdminUserSearchSelect activeOnly />
                    </Form.Item>
                    <Form.Item name="templateId" label={t("grantCoupon")} rules={[{ required: true, message: t("grantCouponRequired") }]}>
                        <Select optionFilterProp="label" options={templates.filter((item) => item.enabled).map((item) => ({ value: item.id, label: `${item.name} · ${item.code}` }))} />
                    </Form.Item>
                </Form>
            </Modal>
        </section>
    );
}

function templateState(template: CouponTemplate, t: CouponT) {
    const now = Date.now();
    if (!template.enabled) return { label: t("stateDisabled"), color: "default" };
    if (Date.parse(template.startsAt) > now) return { label: t("statePending"), color: "blue" };
    if (Date.parse(template.endsAt) <= now) return { label: t("stateExpired"), color: "default" };
    if (template.totalLimit > 0 && template.issuedCount >= template.totalLimit) return { label: t("stateSoldOut"), color: "orange" };
    return { label: t("stateActive"), color: "green" };
}

function discountLabel(template: CouponTemplate, numberLocale: string) {
    if (template.discountType === "fixed") return `¥ ${formatYuan(template.discountValue, numberLocale)}`;
    return `${formatNumber(template.discountValue / 100, numberLocale)}%`;
}

function formatYuan(amountCents: number, numberLocale: string) {
    return (Math.max(0, amountCents) / 100).toLocaleString(numberLocale, { minimumFractionDigits: amountCents % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

function formatNumber(value: number, numberLocale: string) {
    return value.toLocaleString(numberLocale, { maximumFractionDigits: 2 });
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-[11px] text-stone-500 dark:text-stone-400">{label}</div>
            <div className="mt-1 truncate text-xs font-semibold tabular-nums text-stone-900 dark:text-stone-100">{value}</div>
        </div>
    );
}

function Loading({ label }: { label: string }) {
    return (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 px-3 py-10 text-sm text-stone-500 lg:col-span-2 dark:border-stone-800 dark:text-stone-400">
            <RefreshCw className="size-4 animate-spin" /> {label}
        </div>
    );
}

function Empty({ label }: { label: string }) {
    return <div className="rounded-lg border border-dashed border-stone-200 px-3 py-10 text-center text-sm text-stone-500 lg:col-span-2 dark:border-stone-800 dark:text-stone-400">{label}</div>;
}
