"use client";

import { App, Button, Empty, QRCode, Spin, Tag } from "antd";
import { ArrowLeft, Check, CheckCircle2, Copy, CreditCard, ExternalLink, FileText, Landmark, LockKeyhole, Minus, Plus, QrCode, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CreditSymbol, formatCreditAmount } from "@/constant/credits";
import { useCopyText } from "@/hooks/use-copy-text";
import { resolveBrandProductName } from "@/lib/site-brand";
import { usePublicSessionStore } from "@/stores/use-public-session-store";
import { createBillingOrder, createPaymentCheckout, listBillingProducts, type BillingProduct, type PaymentCheckout } from "@/services/api/billing";

export function BillingCheckoutPage({ productId }: { productId: string }) {
    const { message } = App.useApp();
    const t = useTranslations("workspace.billing.checkout");
    const copyText = useCopyText();
    const providers = [
        { label: "Stripe", value: "stripe", icon: CreditCard, description: t("providerStripeDesc") },
        { label: t("providerAlipay"), value: "alipay", icon: Landmark, description: t("providerAlipayDesc") },
        { label: t("providerWechat"), value: "wechat", icon: QrCode, description: t("providerWechatDesc") },
        { label: "PayPly", value: "payply", icon: WalletCards, description: t("providerPayplyDesc") },
        { label: t("providerManual"), value: "manual", icon: FileText, description: t("providerManualDesc") },
    ] as const;
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", brandProductName: "" };
    const brandProductName = resolveBrandProductName(site);
    const [product, setProduct] = useState<BillingProduct | null>(null);
    const [paymentProviders, setPaymentProviders] = useState<string[]>([]);
    const [provider, setProvider] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [mobileSection, setMobileSection] = useState<"summary" | "payment">("payment");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
    const availableProviders = useMemo(() => providers.filter((item) => paymentProviders.includes(item.value)), [paymentProviders]);

    useEffect(() => {
        let active = true;
        void listBillingProducts()
            .then((payload) => {
                if (!active) return;
                const nextProduct = payload.products.find((item) => item.id === productId) || null;
                const nextProviders = payload.paymentProviders?.length ? payload.paymentProviders : ["manual"];
                setProduct(nextProduct);
                setPaymentProviders(nextProviders);
                setProvider(nextProviders[0] || "manual");
            })
            .catch((error) => message.error(error instanceof Error ? error.message : t("loadFailed")))
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [message, productId, t]);

    const totalCents = (product?.amountCents || 0) * quantity;

    const submit = async () => {
        if (!product || !provider) return;
        setSubmitting(true);
        try {
            const order = await createBillingOrder({ productId: product.id, provider, quantity });
            const result = await createPaymentCheckout(order.order.id, { provider });
            setCheckout(result.checkout);
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("createOrderFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    const openCheckout = () => {
        if (!checkout) return;
        if (checkout.kind === "form" && checkout.formHtml) {
            const popup = window.open("", "_blank");
            if (!popup) return message.warning(t("popupBlocked"));
            popup.document.open();
            popup.document.write(checkout.formHtml);
            popup.document.close();
            return;
        }
        if (checkout.url) return void window.open(checkout.url, "_blank", "noopener,noreferrer");
        message.info(t("needManualConfirm"));
    };

    if (loading) {
        return (
            <main className="h-full min-h-0 overflow-y-auto bg-[#f4f5f2] px-3 py-4 sm:px-4 sm:py-8 dark:bg-[#0f1012]">
                <div className="mx-auto grid min-h-24 max-w-6xl place-items-center sm:min-h-[60dvh]">
                    <Spin />
                </div>
            </main>
        );
    }

    if (!product) {
        return (
            <main className="h-full min-h-0 overflow-y-auto bg-[#f4f5f2] px-3 py-4 sm:px-4 sm:py-8 dark:bg-[#0f1012]">
                <div className="mx-auto max-w-xl rounded-xl border border-stone-200 bg-white p-4 text-center sm:rounded-3xl sm:p-8 dark:border-stone-800 dark:bg-stone-950">
                    <Empty description={t("productNotFound")} />
                    <Link href="/profile?section=billing" className="mt-5 inline-flex text-sm font-semibold text-stone-700 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
                        {t("backToPlans")}
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="h-full min-h-0 overflow-y-auto bg-[#f4f5f2] px-2 py-2 text-stone-950 sm:px-6 sm:py-8 dark:bg-[#0f1012] dark:text-stone-100">
            <div className="mx-auto w-full max-w-6xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-[calc(2rem+env(safe-area-inset-bottom))]">
                <header className="mb-2.5 flex items-center justify-between gap-2 sm:mb-5 sm:gap-4">
                    <Link
                        href="/profile?section=billing"
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-stone-700 dark:hover:bg-stone-900 dark:hover:text-white"
                    >
                        <ArrowLeft className="size-4" /> {t("backToPlans")}
                    </Link>
                    <span className="inline-flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-1.5 sm:text-xs sm:font-medium dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300">
                        <ShieldCheck className="size-4 text-emerald-600 sm:size-3.5 dark:text-emerald-300" /> <span className="hidden sm:inline">{t("securityBadge", { brand: brandProductName })}</span>
                    </span>
                </header>

                <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_18px_54px_rgba(15,23,42,0.10)] sm:rounded-[1.75rem] sm:shadow-[0_30px_90px_rgba(15,23,42,0.12)] lg:grid lg:grid-cols-[0.86fr_1.14fr] dark:border-stone-800 dark:bg-stone-950 dark:shadow-black/35">
                    <div className="m-1.5 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-0.5 sm:hidden dark:bg-stone-900" role="tablist" aria-label={t("checkoutStepsAriaLabel")}>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mobileSection === "summary"}
                            className={`inline-flex h-8 items-center justify-center gap-1 rounded-md text-xs font-semibold transition ${mobileSection === "summary" ? "bg-white text-[#344256] shadow-sm dark:bg-[#252d37] dark:text-white" : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"}`}
                            onClick={() => setMobileSection("summary")}
                        >
                            <ReceiptText className={`size-4 ${mobileSection === "summary" ? "text-[#66758e] dark:text-[#d8dee8]" : ""}`} /> {t("tabOrderDetail")}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={mobileSection === "payment"}
                            className={`inline-flex h-8 items-center justify-center gap-1 rounded-md text-xs font-semibold transition ${mobileSection === "payment" ? "bg-white text-[#344256] shadow-sm dark:bg-[#252d37] dark:text-white" : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"}`}
                            onClick={() => setMobileSection("payment")}
                        >
                            <CreditCard className={`size-4 ${mobileSection === "payment" ? "text-[#66758e] dark:text-[#d8dee8]" : ""}`} /> {t("tabPaymentMethod")}
                        </button>
                    </div>

                    <section className={`${mobileSection === "summary" ? "block" : "hidden"} relative overflow-hidden bg-stone-950 p-2.5 text-white sm:block sm:p-8 lg:min-h-[34rem] dark:bg-stone-100 dark:text-stone-950`}>
                        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-[#66758e]/30 blur-3xl dark:bg-[#66758e]/20" />
                        <div className="relative">
                            <div className="text-[11px] font-semibold tracking-[0.2em] text-[#b8c4d6] dark:text-[#66758e]">{brandProductName} CHECKOUT</div>
                            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:mt-5 sm:text-3xl">{product.name}</h1>
                            <p className="mt-3 max-w-md text-sm leading-6 text-stone-300 dark:text-stone-600">{product.description}</p>

                            <div className="mt-4 flex items-end gap-1 sm:mt-8">
                                <span className="pb-1 text-sm">¥</span>
                                <span className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">{formatYuan(totalCents)}</span>
                                <span className="pb-1 text-sm text-stone-400 dark:text-stone-500">{t("payTodayLabel")}</span>
                            </div>

                            <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] sm:mt-8 sm:rounded-2xl dark:border-stone-300 dark:bg-white">
                                <SummaryRow label={t("unitPriceLabel")} value={`¥ ${formatYuan(product.amountCents)}`} />
                                <SummaryRow label={t("quantityLabel")} value={`× ${quantity}`} />
                                <SummaryRow label={product.productKind === "points" ? t("pointsRecharge") : t("pointsCreative")} value={t("pointsValue", { amount: formatCreditAmount(product.pointsAmount * quantity) })} icon={<CreditSymbol />} />
                                <SummaryRow label={t("periodLabel")} value={product.productKind === "points" ? t("periodOneTime") : product.periodDays ? t("periodDays", { days: product.periodDays * quantity }) : t("periodLongTerm")} />
                            </div>

                            <div className="mt-6 flex items-start gap-2 text-xs leading-5 text-stone-400 dark:text-stone-600">
                                <ReceiptText className="mt-0.5 size-4 shrink-0 text-[#b8c4d6] dark:text-[#66758e]" />
                                {t("orderNote")}
                            </div>
                        </div>
                    </section>

                    <section className={`${mobileSection === "payment" ? "block" : "hidden"} p-2.5 sm:block sm:p-8`}>
                        <div className="mb-4 flex items-end justify-between gap-3 border-b border-stone-200 pb-3 sm:hidden dark:border-stone-800">
                            <div className="min-w-0">
                                <div className="text-[10px] font-semibold tracking-[0.16em] text-stone-400 dark:text-stone-500">{t("currentOrderLabel")}</div>
                                <div className="mt-1 truncate text-sm font-semibold text-stone-950 dark:text-white">{product.name}</div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-[11px] text-stone-500 dark:text-stone-400">{t("amountDueLabel")}</div>
                                <div className="mt-0.5 text-xl font-semibold tabular-nums text-stone-950 dark:text-white">¥ {formatYuan(totalCents)}</div>
                            </div>
                        </div>
                        {!checkout ? (
                            <>
                                <div>
                                    <div className="text-[11px] font-semibold tracking-[0.18em] text-stone-400 dark:text-stone-500">PAYMENT</div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("choosePaymentMethod")}</h2>
                                        <Tag color="green" className="m-0">
                                            <span className="inline-flex items-center gap-1">
                                                <LockKeyhole className="size-3" /> {t("secureEncryption")}
                                            </span>
                                        </Tag>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-1.5 sm:mt-6 sm:space-y-3">
                                    {availableProviders.map((item) => {
                                        const Icon = item.icon;
                                        const selected = provider === item.value;
                                        return (
                                            <button
                                                key={item.value}
                                                type="button"
                                                aria-pressed={selected}
                                                className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition sm:rounded-2xl sm:p-4 ${selected ? "border-stone-950 bg-stone-50 ring-1 ring-stone-950 dark:border-stone-200 dark:bg-stone-900 dark:ring-stone-200" : "border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-950 dark:hover:border-stone-600 dark:hover:bg-stone-900/70"}`}
                                                onClick={() => setProvider(item.value)}
                                            >
                                                <span
                                                    className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-11 sm:rounded-xl ${selected ? "bg-stone-950 text-white dark:bg-white dark:text-stone-950" : "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-300"}`}
                                                >
                                                    <Icon className="size-5" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-stone-950 dark:text-white">{item.label}</span>
                                                    <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{item.description}</span>
                                                </span>
                                                <span
                                                    className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${selected ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 dark:border-emerald-500 dark:bg-emerald-500" : "border-stone-300 bg-white text-transparent dark:border-stone-700 dark:bg-stone-950"}`}
                                                    aria-hidden="true"
                                                >
                                                    <Check className="size-3.5" strokeWidth={2.5} />
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 border-t border-stone-200 pt-4 sm:mt-7 sm:pt-7 dark:border-stone-800">
                                    <label className="flex items-center justify-between gap-5">
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold">{t("quantityLabel")}</span>
                                            <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">{t("quantityHint")}</span>
                                        </span>
                                        <div className="grid h-9 shrink-0 grid-cols-[2rem_2.5rem_2rem] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
                                            <button
                                                type="button"
                                                className="grid place-items-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-35 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white"
                                                aria-label={t("decreaseQuantity")}
                                                title={t("decreaseQuantityTitle")}
                                                disabled={quantity <= 1}
                                                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                                            >
                                                <Minus className="size-3.5" />
                                            </button>
                                            <span className="grid place-items-center border-x border-stone-200 text-sm font-semibold tabular-nums text-stone-950 dark:border-stone-800 dark:text-white" aria-live="polite">
                                                {quantity}
                                            </span>
                                            <button
                                                type="button"
                                                className="grid place-items-center text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-35 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-white"
                                                aria-label={t("increaseQuantity")}
                                                title={t("increaseQuantityTitle")}
                                                disabled={quantity >= 24}
                                                onClick={() => setQuantity((current) => Math.min(24, current + 1))}
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                    </label>

                                    <div className="mt-4 border-t border-dashed border-stone-200 pt-4 sm:mt-7 sm:pt-6 dark:border-stone-800">
                                        <Button block type="primary" size="large" className="profile-primary-button !h-10 sm:!h-12" loading={submitting} disabled={!provider} onClick={() => void submit()}>
                                            <span className="inline-flex items-center gap-2">
                                                <LockKeyhole className="size-4" /> {t("confirmAndPay")}
                                            </span>
                                        </Button>
                                        <p className="mt-3 text-center text-xs leading-5 text-stone-500 dark:text-stone-400">{t("payHint")}</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex min-h-36 flex-col items-center justify-center text-center sm:min-h-[30rem]">
                                <span className="grid size-16 place-items-center rounded-2xl bg-[#eef2f7] text-[#52627a] dark:bg-[#66758e]/15 dark:text-[#d8dee8]">
                                    <CheckCircle2 className="size-8" />
                                </span>
                                <h2 className="mt-5 text-2xl font-semibold">{t("orderCreated")}</h2>
                                <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t("orderNoDisplay", { orderNo: checkout.orderNo })}</p>
                                {checkout.qrContent ? <QRCode className="mt-6" value={checkout.qrContent} size={190} /> : null}
                                <div className="mt-7 grid w-full max-w-md gap-3 sm:grid-cols-2">
                                    <Button icon={<Copy className="size-4" />} onClick={() => copyText(checkout.qrContent || checkout.url || checkout.orderNo, t("paymentInfoCopied"))}>
                                        {t("copyPaymentInfo")}
                                    </Button>
                                    <Button type="primary" className="profile-primary-button" icon={<ExternalLink className="size-4" />} onClick={openCheckout}>
                                        {checkout.kind === "manual" ? t("viewOrderInstructions") : t("goToPay")}
                                    </Button>
                                </div>
                                <Link href="/profile?section=orders" className="mt-5 text-sm font-medium text-stone-500 hover:text-stone-950 dark:text-stone-400 dark:hover:text-white">
                                    {t("backToProfileOrders")}
                                </Link>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-3 py-2.5 text-sm last:border-b-0 sm:px-4 sm:py-3.5 dark:border-stone-200">
            <span className="text-stone-400 dark:text-stone-500">{label}</span>
            <span className="inline-flex items-center gap-1 font-semibold">
                {icon}
                {value}
            </span>
        </div>
    );
}

function formatYuan(amountCents: number) {
    return (Math.max(0, amountCents) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
