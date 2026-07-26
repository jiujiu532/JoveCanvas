"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Database, RefreshCw, ServerCrash, ShieldCheck, Sparkles } from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { SiteLogo } from "@/components/layout/site-logo";
import type { InstallStatus } from "@/lib/server/install-status";
import { usePublicSessionStore } from "@/stores/use-public-session-store";
import { DatabaseConfigBuilder } from "./database-config-builder";

type InstallStepId = "intro" | "database" | "admin";

const primaryButtonClass =
    "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold !text-white shadow-sm shadow-slate-950/15 transition enabled:hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300 disabled:!text-white disabled:shadow-none [&_svg]:!text-white";
const secondaryButtonClass = "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white";
const ghostButtonClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900";

export function InstallWizard({ install }: { install: InstallStatus }) {
    const t = useTranslations("public.install");
    const [activeStep, setActiveStep] = useState<InstallStepId>("intro");
    const [currentInstall, setCurrentInstall] = useState(install);
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", logoUrl: "/logo.svg" };
    const databaseReady = currentInstall.database.healthy && currentInstall.database.schemaReady;
    const schemaPending = currentInstall.database.healthy && !currentInstall.database.schemaReady;
    const runtimeReady = databaseReady && currentInstall.security.encryptionReady;
    const steps = useMemo(
        () => [
            { id: "intro" as const, title: t("steps.intro.title"), description: t("steps.intro.description") },
            { id: "database" as const, title: t("steps.database.title"), description: t("steps.database.description") },
            { id: "admin" as const, title: t("steps.admin.title"), description: t("steps.admin.description") },
        ],
        [t],
    );
    const status = useMemo(() => installStatusView(currentInstall, t), [currentInstall, t]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [activeStep]);

    const goStep = (step: InstallStepId) => {
        if (step === "admin" && !runtimeReady) return;
        setActiveStep(step);
    };

    return (
        <div className="mx-auto w-full max-w-6xl">
            <header className="flex flex-col gap-4 px-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <Link href="/" className="inline-flex min-w-0 items-center gap-3">
                    <SiteLogo logoUrl={site.logoUrl} className="size-11" />
                    <span className="min-w-0">
                        <span className="block text-2xl font-semibold tracking-normal text-slate-950">{t("wizardTitle", { site: site.title })}</span>
                        <span className="mt-1 block text-sm text-slate-500">{t("wizardSubtitle")}</span>
                    </span>
                </Link>
                <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-sm backdrop-blur ${status.className}`}>
                    {status.icon}
                    {status.label}
                </span>
            </header>

            <section className="mt-4 grid overflow-hidden rounded-lg border border-white/70 bg-white/60 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-2xl lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200/70 bg-white/55 p-4 lg:border-b-0 lg:border-r">
                    <div className="rounded-lg bg-slate-100/80 p-1">
                        {steps.map((step, index) => {
                            const active = activeStep === step.id;
                            const locked = step.id === "admin" && !runtimeReady;
                            const done = step.id === "intro" || (step.id === "database" && runtimeReady) || (step.id === "admin" && currentInstall.ready);
                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => goStep(step.id)}
                                    disabled={locked}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${active ? "bg-white text-slate-950 shadow-sm" : locked ? "cursor-not-allowed text-slate-300" : "text-slate-500 hover:bg-white/70 hover:text-slate-900"}`}
                                >
                                    <span
                                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${active ? "bg-slate-950 text-white" : done ? "bg-emerald-100 text-emerald-700" : locked ? "bg-white/70 text-slate-300" : "bg-white text-slate-400"}`}
                                    >
                                        {done && !active ? <CheckCircle2 className="size-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold">{step.title}</span>
                                        <span className="mt-0.5 block truncate text-xs opacity-70">{locked ? t("stepLockedHint") : step.description}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-200/80 bg-white/70 p-4">
                        <div className="grid grid-cols-3 gap-3">
                            <StatusMetric label={t("metricDatabaseLabel")} value={databaseReady ? t("databaseInitialized") : schemaPending ? t("databasePending") : currentInstall.database.configured ? t("databaseFailed") : t("databaseUnconfigured")} />
                            <StatusMetric label={t("metricEncryptionLabel")} value={currentInstall.security.encryptionReady ? t("encryptionReady") : t("encryptionNotReady")} />
                            <StatusMetric label={t("metricUserLabel")} value={currentInstall.userCount ? t("userCount", { count: currentInstall.userCount }) : t("userNone")} />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500">{currentInstall.database.message}</p>
                    </div>
                </aside>

                <div className="min-w-0 bg-white/50">
                    {activeStep === "intro" ? <IntroStep onNext={() => setActiveStep("database")} /> : null}
                    {activeStep === "database" ? <DatabaseStep install={currentInstall} runtimeReady={runtimeReady} onInstallChange={setCurrentInstall} onPrev={() => setActiveStep("intro")} onNext={() => setActiveStep("admin")} /> : null}
                    {activeStep === "admin" ? <AdminStep install={currentInstall} runtimeReady={runtimeReady} onPrev={() => setActiveStep("database")} /> : null}
                </div>
            </section>
        </div>
    );
}

function IntroStep({ onNext }: { onNext: () => void }) {
    const t = useTranslations("public.install");
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", logoUrl: "/logo.svg" };
    return (
        <section className="p-5 sm:p-8">
            <StepHeader step={t("intro.stepLabel")} title={t("intro.title")} description={t("intro.description", { site: site.title })} />

            <div className="mt-7 overflow-hidden rounded-lg border border-slate-200/80 bg-white/75 shadow-sm">
                <ProcessRow index="01" title={t("intro.process1Title")} text={t("intro.process1Text")} />
                <ProcessRow index="02" title={t("intro.process2Title")} text={t("intro.process2Text")} />
                <ProcessRow index="03" title={t("intro.process3Title")} text={t("intro.process3Text")} last />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm leading-6 text-slate-500">{t("intro.footerHint")}</p>
                <button type="button" onClick={onNext} className={primaryButtonClass}>
                    {t("intro.nextButton")}
                    <ArrowRight className="size-4" />
                </button>
            </div>
        </section>
    );
}

function DatabaseStep({ install, runtimeReady, onInstallChange, onPrev, onNext }: { install: InstallStatus; runtimeReady: boolean; onInstallChange: (install: InstallStatus) => void; onPrev: () => void; onNext: () => void }) {
    const t = useTranslations("public.install");
    const [initializing, setInitializing] = useState(false);
    const [initializeError, setInitializeError] = useState("");
    const canInitialize = install.database.configured && install.database.healthy && !install.database.schemaReady && install.security.encryptionReady;
    const schemaPending = install.database.healthy && !install.database.schemaReady;

    const initializeDatabase = async () => {
        setInitializing(true);
        setInitializeError("");
        try {
            const response = await fetch("/api/install/initialize", { method: "POST" });
            const payload = (await response.json().catch(() => ({}))) as { data?: { install?: InstallStatus }; msg?: string };
            if (!response.ok || !payload.data?.install) throw new Error(payload.msg || t("database.initFailedDefault"));
            onInstallChange(payload.data.install);
        } catch (error) {
            setInitializeError(error instanceof Error ? error.message : t("database.initFailedDefault"));
        } finally {
            setInitializing(false);
        }
    };

    return (
        <section className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 p-5 sm:p-8">
                <StepHeader step={t("database.stepLabel")} title={t("database.title")} description={t("database.description")} />
                <div className="mt-6">
                    <DatabaseConfigBuilder />
                </div>
            </div>

            <aside className="border-t border-slate-200/70 bg-slate-50/70 p-5 xl:border-l xl:border-t-0">
                <div className={`rounded-lg border p-4 shadow-sm ${runtimeReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        {runtimeReady ? <CheckCircle2 className="size-4" /> : <Database className="size-4" />}
                        {runtimeReady ? t("database.runtimeReadyTitle") : schemaPending ? t("database.schemaPendingTitle") : t("database.waitingTitle")}
                    </div>
                    <p className="mt-2 text-xs leading-5">{install.database.message}</p>
                    {install.database.detail ? <p className="mt-2 break-words text-xs leading-5 opacity-80">{install.database.detail}</p> : null}
                </div>

                <div className={`mt-3 rounded-lg border p-4 text-sm ${install.security.encryptionReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                    <div className="flex items-center gap-2 font-semibold">
                        <ShieldCheck className="size-4" />
                        {t("database.encryptionTitle")}
                    </div>
                    <p className="mt-2 text-xs leading-5">{install.security.message}</p>
                </div>

                <div className="mt-5 border-l-2 border-slate-300 pl-4">
                    <div className="text-sm font-semibold text-slate-900">{t("database.nextStepsTitle")}</div>
                    <ol className="mt-2 space-y-2 text-xs leading-5 text-slate-500">
                        <li>{t("database.nextStep1")}</li>
                        <li>{t("database.nextStep2")}</li>
                        <li>{t("database.nextStep3")}</li>
                        <li>{t("database.nextStep4")}</li>
                    </ol>
                </div>

                <div className="mt-5 grid gap-2">
                    <Link href="/install" className={secondaryButtonClass}>
                        <RefreshCw className="size-4" />
                        {t("database.refreshCheck")}
                    </Link>
                    {!install.database.schemaReady ? (
                        <button type="button" onClick={() => void initializeDatabase()} disabled={!canInitialize || initializing} className={primaryButtonClass}>
                            <Database className={`size-4 ${initializing ? "animate-pulse" : ""}`} />
                            {initializing ? t("database.initializing") : t("database.initSchema")}
                        </button>
                    ) : null}
                    {initializeError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{initializeError}</p> : null}
                    <button type="button" onClick={onNext} disabled={!runtimeReady} className={primaryButtonClass}>
                        {t("database.nextAdmin")}
                        <ArrowRight className="size-4" />
                    </button>
                    <button type="button" onClick={onPrev} className={ghostButtonClass}>
                        <ArrowLeft className="size-4" />
                        {t("database.backIntro")}
                    </button>
                </div>
            </aside>
        </section>
    );
}

function AdminStep({ install, runtimeReady, onPrev }: { install: InstallStatus; runtimeReady: boolean; onPrev: () => void }) {
    const t = useTranslations("public.install");
    if (!runtimeReady) {
        return (
            <section className="p-5 sm:p-8">
                <StepHeader step={t("admin.notReadyStepLabel")} title={t("admin.notReadyTitle")} description={t("admin.notReadyDescription")} />
                <button type="button" onClick={onPrev} className={`mt-6 ${secondaryButtonClass}`}>
                    <ArrowLeft className="size-4" />
                    {t("admin.backDatabase")}
                </button>
            </section>
        );
    }

    if (install.ready) {
        return (
            <section className="p-5 sm:p-8">
                <StepHeader step={t("admin.readyStepLabel")} title={t("admin.readyTitle")} description={t("admin.readyDescription")} />
                <Link href="/login?next=/admin" className={`mt-6 ${primaryButtonClass}`}>
                    {t("admin.loginBackend")}
                    <ArrowRight className="size-4" />
                </Link>
            </section>
        );
    }

    return (
        <section className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 bg-white/40">
                <AuthForm mode="register" nextPath="/admin" registrationEnabled emailRegistrationEnabled={false} firstUser variant="embedded" className="!border-0 !bg-transparent !shadow-none" />
            </div>
            <aside className="border-t border-slate-200/70 bg-slate-50/70 p-5 xl:border-l xl:border-t-0">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="size-4" />
                        {t("admin.firstAdminNoteTitle")}
                    </div>
                    <p className="mt-2 text-xs leading-5">{t("admin.firstAdminNoteText")}</p>
                </div>
                <button type="button" onClick={onPrev} className={`mt-5 ${ghostButtonClass}`}>
                    <ArrowLeft className="size-4" />
                    {t("admin.backDatabase")}
                </button>
            </aside>
        </section>
    );
}

function StepHeader({ step, title, description }: { step: string; title: string; description: string }) {
    return (
        <div>
            <p className="text-sm font-medium text-slate-700">{step}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">{description}</p>
        </div>
    );
}

function ProcessRow({ index, title, text, last }: { index: string; title: string; text: string; last?: boolean }) {
    return (
        <div className={`grid gap-3 px-5 py-4 sm:grid-cols-[56px_minmax(0,1fr)] ${last ? "" : "border-b border-slate-200/80"}`}>
            <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{index}</div>
            <div>
                <div className="text-base font-semibold text-slate-950">{title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
            </div>
        </div>
    );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-slate-400">{label}</div>
            <div className="mt-1 text-base font-semibold text-slate-950">{value}</div>
        </div>
    );
}

function installStatusView(install: InstallStatus, t: ReturnType<typeof useTranslations>) {
    if (install.ready) {
        return {
            label: t("statusReady"),
            icon: <CheckCircle2 className="size-4" />,
            className: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
        };
    }
    if (install.firstAdminRequired) {
        return {
            label: t("statusWaitingAdmin"),
            icon: <Sparkles className="size-4" />,
            className: "border-slate-200 bg-slate-50/80 text-slate-700",
        };
    }
    if (install.database.configured) {
        if (install.database.healthy && !install.database.schemaReady) {
            return {
                label: t("statusWaitingSchema"),
                icon: <Database className="size-4" />,
                className: "border-amber-200 bg-amber-50/80 text-amber-700",
            };
        }
        return {
            label: t("statusDatabaseError"),
            icon: <ServerCrash className="size-4" />,
            className: "border-rose-200 bg-rose-50/80 text-rose-700",
        };
    }
    return {
        label: t("statusWaitingDatabase"),
        icon: <Circle className="size-4" />,
        className: "border-amber-200 bg-amber-50/80 text-amber-700",
    };
}
