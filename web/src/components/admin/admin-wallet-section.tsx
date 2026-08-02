"use client";

import { Button } from "antd";
import { useTranslations } from "next-intl";
import { CircleDollarSign, CreditCard, PlugZap, ReceiptText, RefreshCw, WalletCards } from "lucide-react";

import { formatCreditAmount } from "@/constant/credits";
import { Metric, Panel, PanelHeader } from "@/components/admin/admin-panel";
import { formatAdminMoney } from "@/components/admin/admin-values";

import type { AdminDashboardController } from "./use-admin-dashboard-controller";
import { FinanceFlowItem, FinanceMiniRow } from "./admin-dashboard-elements";

export function AdminWalletSection({ controller }: { controller: AdminDashboardController }) {
    const t = useTranslations("admin");
    const { billingSummary, billingSummaryLoading, activeSection, setActiveSection, walletSummary, loadBillingSummary } = controller;
    if (activeSection !== "wallet") return null;
    return (
        <div className="space-y-3 sm:space-y-5">
            <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Metric
                    label={t("wallet.metrics.paidAmount")}
                    value={formatAdminMoney(billingSummary?.orders.paidAmountCents || 0)}
                    detail={t("wallet.metrics.paidAmountDetail", { count: billingSummary?.orders.paid || 0 })}
                    icon={<CircleDollarSign className="size-5" />}
                    tone="emerald"
                />
                <Metric
                    label={t("wallet.metrics.pendingAmount")}
                    value={formatAdminMoney(billingSummary?.orders.pendingAmountCents || 0)}
                    detail={t("wallet.metrics.pendingAmountDetail", { count: billingSummary?.orders.pending || 0 })}
                    icon={<ReceiptText className="size-5" />}
                    tone="amber"
                />
                <Metric
                    label={t("wallet.metrics.refundedAmount")}
                    value={formatAdminMoney(billingSummary?.orders.refundedAmountCents || 0)}
                    detail={t("wallet.metrics.refundedAmountDetail", { count: billingSummary?.orders.refunded || 0 })}
                    icon={<RefreshCw className="size-5" />}
                    tone="blue"
                />
                <Metric
                    label={t("wallet.metrics.userBalance")}
                    value={formatCreditAmount(walletSummary.totalBalance)}
                    detail={t("wallet.metrics.userBalanceDetail")}
                    icon={<WalletCards className="size-5" />}
                    tone="slate"
                />
            </section>
            <Panel>
                <PanelHeader
                    title={t("wallet.title")}
                    description={t("wallet.description")}
                    actions={
                        <Button aria-label={t("wallet.refresh")} title={t("wallet.refresh")} loading={billingSummaryLoading} icon={<RefreshCw className="size-4" />} onClick={() => void loadBillingSummary()}>
                            <span className="hidden sm:inline">{t("wallet.refresh")}</span>
                        </Button>
                    }
                />
                <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
                        <FinanceFlowItem
                            title={t("wallet.flow.topupIncome.title")}
                            amount={formatAdminMoney(billingSummary?.orders.paidAmountCents || 0)}
                            description={t("wallet.flow.topupIncome.description", { count: billingSummary?.orders.paid || 0 })}
                            icon={<CircleDollarSign className="size-4" />}
                        />
                        <FinanceFlowItem
                            title={t("wallet.flow.refundExpense.title")}
                            amount={formatAdminMoney(billingSummary?.orders.refundedAmountCents || 0)}
                            description={t("wallet.flow.refundExpense.description", { count: billingSummary?.orders.refunded || 0 })}
                            icon={<ReceiptText className="size-4" />}
                        />
                        <FinanceFlowItem
                            title={t("wallet.flow.netIncome.title")}
                            amount={formatAdminMoney((billingSummary?.orders.paidAmountCents || 0) - (billingSummary?.orders.refundedAmountCents || 0))}
                            description={t("wallet.flow.netIncome.description")}
                            icon={<CircleDollarSign className="size-4" />}
                        />
                        <FinanceFlowItem
                            title={t("wallet.flow.pointsLiability.title")}
                            amount={t("wallet.flow.pointsLiability.amount", { count: formatCreditAmount(walletSummary.totalBalance) })}
                            description={t("wallet.flow.pointsLiability.description")}
                            icon={<WalletCards className="size-4" />}
                        />
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:p-4 dark:border-stone-800 dark:bg-stone-900/40">
                        <div className="text-sm font-semibold text-stone-950 dark:text-stone-100">{t("wallet.reconciliationNote.title")}</div>
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500 sm:line-clamp-none sm:text-sm sm:leading-6 dark:text-stone-400">{t("wallet.reconciliationNote.description")}</div>
                        <div className="mt-4 grid gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm dark:border-stone-800 dark:bg-stone-950">
                            <FinanceMiniRow label={t("wallet.mini.totalOrdersLabel")} value={t("wallet.mini.totalOrders", { count: billingSummary?.orders.total || 0 })} />
                            <FinanceMiniRow
                                label={t("wallet.mini.reconciliationIssuesLabel")}
                                value={t("wallet.mini.reconciliationIssues", {
                                    count: billingSummary
                                        ? billingSummary.reconciliation.paidOrdersWithoutSucceededPayment +
                                          billingSummary.reconciliation.succeededPaymentsWithoutPaidOrder +
                                          billingSummary.reconciliation.amountMismatchPayments
                                        : 0,
                                })}
                            />
                            <FinanceMiniRow label={t("wallet.mini.plansOnSaleLabel")} value={t("wallet.mini.plansOnSale", { count: walletSummary.enabledPlans })} />
                            <FinanceMiniRow label={t("wallet.mini.planUsersLabel")} value={t("wallet.mini.planUsers", { count: walletSummary.usersWithPlan })} />
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:grid-cols-1 sm:gap-2">
                            <Button className="px-2 text-xs sm:px-3 sm:text-sm" onClick={() => setActiveSection("products")} icon={<CreditCard className="size-3.5 sm:size-4" />}>
                                {t("nav.sections.products.label")}
                            </Button>
                            <Button className="px-2 text-xs sm:px-3 sm:text-sm" onClick={() => setActiveSection("orders")} icon={<ReceiptText className="size-3.5 sm:size-4" />}>
                                {t("nav.sections.orders.label")}
                            </Button>
                            <Button className="px-2 text-xs sm:px-3 sm:text-sm" onClick={() => setActiveSection("payments")} icon={<PlugZap className="size-3.5 sm:size-4" />}>
                                {t("nav.sections.payments.label")}
                            </Button>
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}
