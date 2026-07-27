"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, DatePicker, Form, Input, InputNumber, Modal, Select, Segmented, Space, Switch, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Copy, CreditCard, FileText, FileUp, Landmark, Package, Pencil, Plus, QrCode, ReceiptText, RefreshCw, Save, Search, Settings2, Trash2, Undo2, WalletCards, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PaymentConfigRequirement, PaymentConfigSummary, PaymentProviderConfig, PaymentProviderConfigField } from "@/lib/payment-config-types";
import type { AdminBillingSummary as BillingSummary } from "@/lib/admin-billing-types";
import type { BillingOrder, BillingOrderStatus, BillingProduct } from "@/services/api/billing";
import { BillingReconciliationImport } from "./billing-reconciliation-import";

type BillingTab = "orders" | "products" | "payments";

const PAGE_SIZE = 20;

type ProductFormValue = {
    id?: string;
    productKind: "plan" | "points";
    planId?: string;
    name: string;
    description?: string;
    amountYuan: number;
    currency: string;
    pointsAmount: number;
    dailyPoints: number;
    periodDays: number;
    enabled: boolean;
    sortOrder: number;
};

function defaultProductFormValue(sortOrder: number): ProductFormValue {
    return {
        id: "",
        productKind: "plan",
        planId: "creator",
        name: "",
        description: "",
        amountYuan: 0,
        currency: "CNY",
        pointsAmount: 0,
        dailyPoints: 0,
        periodDays: 30,
        enabled: true,
        sortOrder,
    };
}

import {
    ReconciliationPanel,
    ActiveProductsPanel,
    ProductFact,
    PaymentConfigPanel,
    PaymentProviderCard,
    PaymentFieldSection,
    sortPaymentFields,
    isWidePaymentField,
    PaymentConfigFieldControl,
    PaymentFieldHeader,
    RequirementGrid,
    providerIcon,
    normalizePaymentFormValue,
    copyText,
    Metric,
    CheckLine,
    metricTone,
    statusLabel,
    statusColor,
    providerLabel,
    formatMoney,
    formatTime,
} from "./billing-operation-elements";

export function BillingOperations({ initialTab = "orders", initialPaymentConfig, embedded = false, hideTabs = false }: { initialTab?: BillingTab; initialPaymentConfig?: PaymentConfigSummary; embedded?: boolean; hideTabs?: boolean }) {
    const t = useTranslations("admin");
    const { message, modal } = App.useApp();
    const [productForm] = Form.useForm<ProductFormValue>();
    const [activeTab, setActiveTab] = useState<BillingTab>(initialTab);

    const tabOptions = useMemo(
        () =>
            [
                { label: t("billingOps.tabs.orders"), value: "orders" as const },
                { label: t("billingOps.tabs.products"), value: "products" as const },
                { label: t("billingOps.tabs.payments"), value: "payments" as const },
            ] satisfies Array<{ label: string; value: BillingTab }>,
        [t],
    );
    const statusOptions = useMemo(
        () =>
            [
                { label: t("billingOps.status.all"), value: "" as const },
                { label: t("billingOps.status.pending"), value: "pending" as const },
                { label: t("billingOps.status.paid"), value: "paid" as const },
                { label: t("billingOps.status.closed"), value: "closed" as const },
                { label: t("billingOps.status.canceled"), value: "canceled" as const },
                { label: t("billingOps.status.refunded"), value: "refunded" as const },
                { label: t("billingOps.status.refunding"), value: "refunding" as const },
            ] satisfies Array<{ label: string; value: BillingOrderStatus | "" }>,
        [t],
    );
    const [summary, setSummary] = useState<BillingSummary | null>(null);
    const [orders, setOrders] = useState<BillingOrder[]>([]);
    const [products, setProducts] = useState<BillingProduct[]>([]);
    const [editingProductId, setEditingProductId] = useState("");
    const [productModalOpen, setProductModalOpen] = useState(false);
    const [reconciliationImportOpen, setReconciliationImportOpen] = useState(false);
    const [productSaving, setProductSaving] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState<PaymentConfigSummary | null>(initialPaymentConfig || null);
    const [paymentConfigLoading, setPaymentConfigLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState<BillingOrderStatus | "">("");
    const [keyword, setKeyword] = useState("");
    const [submittedKeyword, setSubmittedKeyword] = useState("");
    const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
    const [loading, setLoading] = useState(initialTab === "orders");
    const [productsLoading, setProductsLoading] = useState(initialTab !== "payments");
    const [actionOrderId, setActionOrderId] = useState("");
    const [deletingProductId, setDeletingProductId] = useState("");
    const productKind = Form.useWatch("productKind", productForm) || "plan";

    const startDate = range?.[0]?.format("YYYY-MM-DD");
    const endDate = range?.[1]?.format("YYYY-MM-DD");

    const loadProducts = useCallback(async () => {
        setProductsLoading(true);
        try {
            const response = await fetch("/api/admin/billing/products", { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as { products?: BillingProduct[]; error?: string } | null;
            if (!response.ok || !payload?.products) throw new Error(payload?.error || t("billingOps.loadProductsFailed"));
            setProducts(payload.products);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("billingOps.loadProductsFailed"));
        } finally {
            setProductsLoading(false);
        }
    }, [message, t]);

    const loadPaymentConfig = useCallback(async () => {
        setPaymentConfigLoading(true);
        try {
            const response = await fetch("/api/admin/billing/payment-config", { cache: "no-store" });
            const payload = (await response.json().catch(() => null)) as { paymentConfig?: PaymentConfigSummary; error?: string } | null;
            if (!response.ok || !payload?.paymentConfig) throw new Error(payload?.error || t("billingOps.loadPaymentConfigFailed"));
            setPaymentConfig(payload.paymentConfig);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("billingOps.loadPaymentConfigFailed"));
        } finally {
            setPaymentConfigLoading(false);
        }
    }, [message, t]);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const summaryParams = new URLSearchParams();
            if (startDate) summaryParams.set("startDate", startDate);
            if (endDate) summaryParams.set("endDate", endDate);

            const orderParams = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
            if (status) orderParams.set("status", status);
            if (submittedKeyword) orderParams.set("keyword", submittedKeyword);

            const [summaryResponse, ordersResponse] = await Promise.all([fetch(`/api/admin/billing/summary?${summaryParams.toString()}`, { cache: "no-store" }), fetch(`/api/admin/billing/orders?${orderParams.toString()}`, { cache: "no-store" })]);
            const summaryPayload = (await summaryResponse.json().catch(() => null)) as { summary?: BillingSummary; error?: string } | null;
            const ordersPayload = (await ordersResponse.json().catch(() => null)) as { orders?: BillingOrder[]; total?: number; error?: string } | null;
            if (!summaryResponse.ok || !summaryPayload?.summary) throw new Error(summaryPayload?.error || t("billingOps.loadSummaryFailed"));
            if (!ordersResponse.ok || !ordersPayload?.orders) throw new Error(ordersPayload?.error || t("billingOps.loadOrdersFailed"));
            setSummary(summaryPayload.summary);
            setOrders(ordersPayload.orders);
            setTotal(ordersPayload.total || 0);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("billingOps.loadDashboardFailed"));
        } finally {
            setLoading(false);
        }
    }, [endDate, message, page, startDate, status, submittedKeyword, t]);

    useEffect(() => {
        if (activeTab === "orders" || activeTab === "products") void loadProducts();
    }, [activeTab, loadProducts]);

    useEffect(() => {
        if (activeTab === "orders") void loadDashboard();
    }, [activeTab, loadDashboard]);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (activeTab === "payments" && !paymentConfig) void loadPaymentConfig();
    }, [activeTab, loadPaymentConfig, paymentConfig]);

    const runOrderAction = async (order: BillingOrder, action: "complete" | "close" | "refund", reason?: string) => {
        setActionOrderId(`${action}:${order.id}`);
        try {
            const response = await fetch(`/api/admin/billing/orders/${order.id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(action === "complete" ? { provider: order.provider || "manual", channel: "admin-manual", providerTradeId: order.providerOrderId || order.orderNo } : { reason }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || t("billingOps.orderActionFailed"));
            message.success(action === "complete" ? t("billingOps.completeSuccess") : action === "close" ? t("billingOps.closeSuccess") : t("billingOps.refundSuccess"));
            await loadDashboard();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("billingOps.orderActionFailed"));
        } finally {
            setActionOrderId("");
        }
    };

    const confirmOrderAction = (order: BillingOrder, action: "complete" | "close" | "refund") => {
        if (action === "complete") {
            modal.confirm({
                title: t("billingOps.completeConfirmTitle"),
                content: t("billingOps.completeConfirmContent"),
                okText: t("billingOps.completeOk"),
                cancelText: t("common.cancel"),
                onOk: () => runOrderAction(order, action),
            });
            return;
        }

        let reason = "";
        modal.confirm({
            title: action === "close" ? t("billingOps.closeConfirmTitle") : t("billingOps.refundConfirmTitle"),
            content: (
                <Input.TextArea
                    rows={3}
                    maxLength={200}
                    placeholder={action === "close" ? t("billingOps.closeReasonPlaceholder") : t("billingOps.refundReasonPlaceholder")}
                    onChange={(event) => {
                        reason = event.target.value;
                    }}
                />
            ),
            okText: action === "close" ? t("billingOps.closeOk") : t("billingOps.refundOk"),
            cancelText: t("common.cancel"),
            okButtonProps: { danger: action === "refund" },
            onOk: () => runOrderAction(order, action, reason),
        });
    };

    const reconciliationIssues = summary ? summary.reconciliation.paidOrdersWithoutSucceededPayment + summary.reconciliation.succeededPaymentsWithoutPaidOrder + summary.reconciliation.amountMismatchPayments : 0;
    const activeProducts = useMemo(() => products.filter((product) => product.enabled), [products]);
    const openCreateProductModal = () => {
        setEditingProductId("");
        productForm.resetFields();
        productForm.setFieldsValue(defaultProductFormValue(products.length + 1));
        setProductModalOpen(true);
    };
    const closeProductModal = () => {
        if (productSaving) return;
        setProductModalOpen(false);
        setEditingProductId("");
        productForm.resetFields();
    };
    const editProduct = (product: BillingProduct) => {
        setEditingProductId(product.id);
        productForm.setFieldsValue({
            id: product.id,
            productKind: product.productKind || "plan",
            planId: product.planId,
            name: product.name,
            description: product.description,
            amountYuan: Number((product.amountCents / 100).toFixed(2)),
            currency: product.currency,
            pointsAmount: product.pointsAmount,
            dailyPoints: product.dailyPoints,
            periodDays: product.periodDays,
            enabled: product.enabled,
            sortOrder: product.sortOrder || 0,
        });
        setProductModalOpen(true);
    };
    const saveProduct = async (value: ProductFormValue) => {
        setProductSaving(true);
        try {
            const response = await fetch("/api/admin/billing/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: value.id || undefined,
                    productKind: value.productKind,
                    planId: value.productKind === "plan" ? value.planId : undefined,
                    name: value.name,
                    description: value.description || "",
                    amountCents: Math.round(Number(value.amountYuan || 0) * 100),
                    currency: value.currency,
                    pointsAmount: value.pointsAmount,
                    dailyPoints: value.productKind === "plan" ? value.dailyPoints : 0,
                    periodDays: value.productKind === "plan" ? value.periodDays : 0,
                    enabled: value.enabled,
                    sortOrder: value.sortOrder,
                }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || t("billingOps.saveProductFailed"));
            message.success(t("billingOps.saveProductSuccess"));
            setProductModalOpen(false);
            setEditingProductId("");
            productForm.resetFields();
            await loadProducts();
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("billingOps.saveProductFailed"));
        } finally {
            setProductSaving(false);
        }
    };
    const confirmDeleteProduct = (product: BillingProduct) => {
        modal.confirm({
            title: t("billingOps.deleteProductTitle", { name: product.name }),
            content: t("billingOps.deleteProductContent"),
            okText: t("billingOps.deleteConfirm"),
            okButtonProps: { danger: true },
            cancelText: t("common.cancel"),
            onOk: async () => {
                setDeletingProductId(product.id);
                try {
                    const response = await fetch(`/api/admin/billing/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                    if (response.status === 409) {
                        modal.warning({
                            title: t("billingOps.productHasOrdersTitle"),
                            content: payload?.error || t("billingOps.productHasOrdersContent"),
                            okText: t("billingOps.goEditDelist"),
                            onOk: () => editProduct(product),
                        });
                        return;
                    }
                    if (!response.ok) throw new Error(payload?.error || t("billingOps.deleteProductFailed"));
                    message.success(t("billingOps.deleteProductSuccess"));
                    await loadProducts();
                } catch (error) {
                    message.error(error instanceof Error ? error.message : t("billingOps.deleteProductFailed"));
                    throw error;
                } finally {
                    setDeletingProductId("");
                }
            },
        });
    };

    const columns: TableColumnsType<BillingOrder> = [
        {
            title: t("billingOps.table.order"),
            dataIndex: "orderNo",
            width: 230,
            render: (_, order) => (
                <div className="min-w-0">
                    <div className="truncate font-medium text-stone-950 dark:text-stone-100">{order.orderNo}</div>
                    <div className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">{order.subject}</div>
                </div>
            ),
        },
        {
            title: t("billingOps.table.status"),
            dataIndex: "status",
            width: 110,
            render: (value: BillingOrderStatus) => <Tag color={statusColor(value)}>{statusLabel(value, t)}</Tag>,
        },
        {
            title: t("billingOps.table.channel"),
            dataIndex: "provider",
            width: 110,
            render: (value: string) => <span className="text-sm text-stone-700 dark:text-stone-200">{providerLabel(value, t)}</span>,
        },
        {
            title: t("billingOps.table.amount"),
            dataIndex: "amountCents",
            width: 130,
            render: (_, order) => <span className="font-medium">{formatMoney(order.amountCents, order.currency)}</span>,
        },
        {
            title: t("billingOps.table.entitlement"),
            width: 150,
            render: (_, order) => (
                <div className="text-sm text-stone-600 dark:text-stone-300">
                    <div>{t("billingOps.table.permanentPoints", { count: order.pointsAmount })}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                        {t("billingOps.table.dailyAndPeriod", {
                            daily: order.dailyPoints,
                            period: order.periodDays ? t("billingOps.table.days", { count: order.periodDays }) : t("billingOps.table.longTerm"),
                        })}
                    </div>
                </div>
            ),
        },
        {
            title: t("billingOps.table.user"),
            dataIndex: "userId",
            width: 180,
            render: (value?: string) => <span className="font-mono text-xs text-stone-500 dark:text-stone-400">{value || "-"}</span>,
        },
        {
            title: t("billingOps.table.createdAt"),
            dataIndex: "createdAt",
            width: 170,
            render: (value: string) => formatTime(value),
        },
        {
            title: t("billingOps.table.actions"),
            fixed: "right",
            width: 230,
            render: (_, order) => (
                <Space size={6} wrap>
                    {order.status === "pending" ? (
                        <>
                            <Button size="small" icon={<CheckCircle2 className="size-3.5" />} loading={actionOrderId === `complete:${order.id}`} onClick={() => confirmOrderAction(order, "complete")}>
                                {t("billingOps.table.collect")}
                            </Button>
                            <Button size="small" icon={<XCircle className="size-3.5" />} loading={actionOrderId === `close:${order.id}`} onClick={() => confirmOrderAction(order, "close")}>
                                {t("billingOps.table.close")}
                            </Button>
                        </>
                    ) : null}
                    {order.status === "paid" ? (
                        <Button danger size="small" icon={<Undo2 className="size-3.5" />} loading={actionOrderId === `refund:${order.id}`} onClick={() => confirmOrderAction(order, "refund")}>
                            {t("billingOps.table.refund")}
                        </Button>
                    ) : null}
                </Space>
            ),
        },
    ];

    return (
        <div className="space-y-3 sm:space-y-5">
            {!hideTabs ? (
                <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20">
                    <Segmented
                        block
                        value={activeTab}
                        options={tabOptions}
                        onChange={(value) => setActiveTab(value as BillingTab)}
                        className="[&_.ant-segmented-group]:!flex [&_.ant-segmented-item]:!min-w-0 [&_.ant-segmented-item]:!flex-1 [&_.ant-segmented-item-label]:!text-center"
                    />
                </section>
            ) : null}

            {activeTab === "orders" ? (
                <>
                    <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Metric title={t("billingOps.metrics.paidAmount")} value={formatMoney(summary?.orders.paidAmountCents || 0)} icon={<CircleDollarSign className="size-4" />} tone="emerald" />
                        <Metric title={t("billingOps.metrics.pendingAmount")} value={formatMoney(summary?.orders.pendingAmountCents || 0)} icon={<WalletCards className="size-4" />} tone="amber" />
                        <Metric title={t("billingOps.metrics.paidOrders")} value={summary?.orders.paid || 0} icon={<ReceiptText className="size-4" />} tone="blue" />
                        <Metric title={t("billingOps.metrics.reconciliationIssues")} value={reconciliationIssues} icon={<AlertTriangle className="size-4" />} tone={reconciliationIssues ? "rose" : "slate"} />
                    </section>

                    <section
                        className={
                            embedded
                                ? "rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-950 sm:p-4"
                                : "rounded-lg border border-stone-200 bg-white p-3 shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20 sm:p-4"
                        }
                    >
                        <div>
                            <div>
                                <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">{t("billingOps.filter.title")}</h2>
                                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t("billingOps.filter.description")}</p>
                            </div>
                            <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_minmax(128px,0.45fr)_minmax(220px,0.9fr)_auto]">
                                <DatePicker.RangePicker className="w-full" value={range} onChange={(value) => setRange(value)} />
                                <Select
                                    className="w-full"
                                    value={status}
                                    options={statusOptions}
                                    onChange={(value) => {
                                        setStatus(value);
                                        setPage(1);
                                    }}
                                />
                                <Input
                                    className="w-full"
                                    allowClear
                                    value={keyword}
                                    prefix={<Search className="size-4 text-stone-400" />}
                                    placeholder={t("billingOps.filter.keywordPlaceholder")}
                                    onChange={(event) => setKeyword(event.target.value)}
                                    onPressEnter={() => {
                                        setSubmittedKeyword(keyword.trim());
                                        setPage(1);
                                    }}
                                />
                                <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-1 xl:flex">
                                    <Button
                                        className="w-full xl:w-auto"
                                        icon={<Search className="size-4" />}
                                        onClick={() => {
                                            setSubmittedKeyword(keyword.trim());
                                            setPage(1);
                                        }}
                                    >
                                        {t("billingOps.filter.query")}
                                    </Button>
                                    <Button className="w-full xl:w-auto" icon={<RefreshCw className="size-4" />} loading={loading || productsLoading} onClick={() => void Promise.all([loadProducts(), loadDashboard()])}>
                                        {t("billingOps.filter.refresh")}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <div className="min-w-0 overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
                                <Table
                                    rowKey="id"
                                    size="middle"
                                    columns={columns}
                                    dataSource={orders}
                                    loading={loading}
                                    scroll={{ x: 1300 }}
                                    pagination={{
                                        current: page,
                                        pageSize: PAGE_SIZE,
                                        total,
                                        showSizeChanger: false,
                                        onChange: setPage,
                                    }}
                                />
                            </div>

                            <aside className="min-w-0 space-y-3">
                                <ReconciliationPanel reconciliationIssues={reconciliationIssues} summary={summary} onImport={() => setReconciliationImportOpen(true)} />
                                <ActiveProductsPanel activeProducts={activeProducts} />
                            </aside>
                        </div>
                    </section>
                    <BillingReconciliationImport open={reconciliationImportOpen} onClose={() => setReconciliationImportOpen(false)} />
                </>
            ) : null}

            {activeTab === "products" ? (
                <>
                    <section className="grid min-w-0 items-start gap-4">
                        <div
                            className={`min-w-0 overflow-hidden ${embedded ? "rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950" : "rounded-lg border border-stone-200 bg-white shadow-sm shadow-stone-200/40 dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/20"}`}
                        >
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 border-b border-stone-200 p-3 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4 dark:border-stone-800">
                                <div className="contents sm:block">
                                    <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">{t("billingOps.products.title")}</h2>
                                    <div className="col-span-2 line-clamp-2 text-xs leading-5 text-stone-500 sm:mt-1 sm:block sm:text-sm dark:text-stone-400">{t("billingOps.products.description")}</div>
                                </div>
                                <div className="col-start-2 row-start-1 flex flex-wrap justify-end gap-1.5 sm:gap-2">
                                    <Button type="primary" aria-label={t("billingOps.products.create")} title={t("billingOps.products.create")} icon={<Plus className="size-4" />} onClick={openCreateProductModal}>
                                        <span className="sm:hidden">{t("billingOps.products.createShort")}</span>
                                        <span className="hidden sm:inline">{t("billingOps.products.create")}</span>
                                    </Button>
                                    <Button aria-label={t("billingOps.products.refreshAria")} title={t("billingOps.products.refreshAria")} icon={<RefreshCw className="size-4" />} loading={productsLoading} onClick={() => void loadProducts()}>
                                        <span className="hidden sm:inline">{t("billingOps.products.refresh")}</span>
                                    </Button>
                                </div>
                            </div>
                            <div className="grid min-w-0 gap-2 p-3 sm:gap-3 sm:p-4 md:grid-cols-2">
                                {productsLoading && !products.length ? (
                                    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 px-3 py-6 text-sm text-stone-500 sm:py-10 md:col-span-2 dark:border-stone-800 dark:text-stone-400">
                                        <RefreshCw className="size-4 animate-spin" />
                                        <span>{t("billingOps.products.loading")}</span>
                                    </div>
                                ) : products.length ? (
                                    products.map((product) => (
                                        <article
                                            key={product.id}
                                            className={`min-w-0 rounded-lg border p-3 text-left transition sm:p-4 ${productModalOpen && editingProductId === product.id ? "border-stone-400 bg-stone-100/80 dark:border-stone-500 dark:bg-stone-800/55" : "border-stone-200 bg-stone-50/70 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-stone-700"}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-stone-950 dark:text-stone-100">{product.name}</div>
                                                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                                                        {product.description || (product.productKind === "points" ? t("billingOps.products.pointsProduct") : product.planId || t("billingOps.products.noPlan"))}
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    <Tag color={product.productKind === "points" ? "gold" : "blue"}>{product.productKind === "points" ? t("billingOps.products.kindPoints") : t("billingOps.products.kindPlan")}</Tag>
                                                    <Tag color={product.enabled ? "green" : "default"}>{product.enabled ? t("billingOps.products.listed") : t("billingOps.products.delisted")}</Tag>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-500 sm:mt-4 sm:grid-cols-4 dark:text-stone-400">
                                                <ProductFact label={t("billingOps.products.price")} value={formatMoney(product.amountCents, product.currency)} />
                                                <ProductFact label={product.productKind === "points" ? t("billingOps.products.rechargePoints") : t("billingOps.products.permanentPoints")} value={`${product.pointsAmount}`} />
                                                <ProductFact label={t("billingOps.products.dailyGift")} value={product.productKind === "plan" ? `${product.dailyPoints}` : "-"} />
                                                <ProductFact
                                                    label={t("billingOps.products.period")}
                                                    value={product.productKind === "plan" ? (product.periodDays ? t("billingOps.table.days", { count: product.periodDays }) : t("billingOps.table.longTerm")) : t("billingOps.products.oneTime")}
                                                />
                                            </div>
                                            <div className="mt-3 flex justify-end gap-2 border-t border-stone-200 pt-2.5 sm:mt-4 sm:pt-3 dark:border-stone-800">
                                                <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => editProduct(product)}>
                                                    {t("billingOps.products.edit")}
                                                </Button>
                                                <Button danger size="small" icon={<Trash2 className="size-3.5" />} loading={deletingProductId === product.id} onClick={() => confirmDeleteProduct(product)}>
                                                    {t("billingOps.products.delete")}
                                                </Button>
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500 sm:gap-3 sm:py-10 md:col-span-2 dark:border-stone-800 dark:text-stone-400">
                                        <span>{t("billingOps.products.empty")}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                    <Modal
                        title={editingProductId ? t("billingOps.products.editTitle") : t("billingOps.products.createTitle")}
                        open={productModalOpen}
                        width={760}
                        centered
                        destroyOnHidden
                        onCancel={closeProductModal}
                        styles={{ body: { maxHeight: "min(68dvh, 640px)", overflowY: "auto", paddingTop: 8 } }}
                        footer={[
                            <Button key="cancel" onClick={closeProductModal} disabled={productSaving}>
                                {t("common.cancel")}
                            </Button>,
                            <Button key="save" type="primary" icon={<Save className="size-4" />} loading={productSaving} onClick={() => productForm.submit()}>
                                {t("billingOps.products.save")}
                            </Button>,
                        ]}
                    >
                        <Form form={productForm} layout="vertical" initialValues={defaultProductFormValue(products.length + 1)} onFinish={(value) => void saveProduct(value)}>
                            <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-500 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400">{t("billingOps.products.modalHint")}</div>
                            <Form.Item name="id" hidden>
                                <Input />
                            </Form.Item>
                            <Form.Item name="name" label={t("billingOps.products.name")} rules={[{ required: true, message: t("billingOps.products.nameRequired") }]}>
                                <Input maxLength={80} placeholder={t("billingOps.products.namePlaceholder")} />
                            </Form.Item>
                            <Form.Item name="description" label={t("billingOps.products.descriptionLabel")}>
                                <Input.TextArea rows={3} maxLength={500} placeholder={t("billingOps.products.descriptionPlaceholder")} />
                            </Form.Item>
                            <Form.Item name="productKind" label={t("billingOps.products.productKind")} rules={[{ required: true, message: t("billingOps.products.productKindRequired") }]}>
                                <Segmented
                                    block
                                    options={[
                                        { label: t("billingOps.products.kindPlanBenefit"), value: "plan" },
                                        { label: t("billingOps.products.kindPointsTopup"), value: "points" },
                                    ]}
                                />
                            </Form.Item>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {productKind === "plan" ? (
                                    <Form.Item name="planId" label={t("billingOps.products.planId")} rules={[{ required: true, message: t("billingOps.products.planIdRequired") }]}>
                                        <Input maxLength={80} placeholder="creator / pro" />
                                    </Form.Item>
                                ) : null}
                                <Form.Item name="currency" label={t("billingOps.products.currency")} rules={[{ required: true, message: t("billingOps.products.currencyRequired") }]}>
                                    <Input maxLength={8} placeholder="CNY" />
                                </Form.Item>
                                <Form.Item name="amountYuan" label={t("billingOps.products.amount")} rules={[{ required: true, message: t("billingOps.products.amountRequired") }]}>
                                    <InputNumber min={0} precision={2} className="w-full" prefix="¥" />
                                </Form.Item>
                                <Form.Item name="pointsAmount" label={t("billingOps.products.pointsAmount")} rules={[{ required: true, message: t("billingOps.products.pointsAmountRequired") }]} extra={t("billingOps.products.pointsAmountExtra")}>
                                    <InputNumber min={0} precision={0} className="w-full" />
                                </Form.Item>
                                {productKind === "plan" ? (
                                    <>
                                        <Form.Item name="dailyPoints" label={t("billingOps.products.dailyPoints")} rules={[{ required: true, message: t("billingOps.products.dailyPointsRequired") }]} extra={t("billingOps.products.dailyPointsExtra")}>
                                            <InputNumber min={0} precision={0} className="w-full" />
                                        </Form.Item>
                                        <Form.Item name="periodDays" label={t("billingOps.products.periodDays")} rules={[{ required: true, message: t("billingOps.products.periodDaysRequired") }]}>
                                            <InputNumber min={1} precision={0} className="w-full" />
                                        </Form.Item>
                                    </>
                                ) : null}
                                <Form.Item name="sortOrder" label={t("billingOps.products.sortOrder")}>
                                    <InputNumber min={0} precision={0} className="w-full" />
                                </Form.Item>
                            </div>
                            <Form.Item name="enabled" label={t("billingOps.products.enabled")} valuePropName="checked">
                                <Switch checkedChildren={t("billingOps.products.listed")} unCheckedChildren={t("billingOps.products.delisted")} />
                            </Form.Item>
                        </Form>
                    </Modal>
                </>
            ) : null}

            {activeTab === "payments" ? (
                <PaymentConfigPanel
                    paymentConfig={paymentConfig}
                    loading={paymentConfigLoading}
                    embedded={embedded}
                    onRefresh={loadPaymentConfig}
                    onCopy={(value) => void copyText(value, message, { copied: t("billingOps.elements.copied"), copyFailed: t("billingOps.elements.copyFailed") })}
                />
            ) : null}
        </div>
    );
}
