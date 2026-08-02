"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Gift, LockKeyhole, Mail, UserRound } from "lucide-react";
import { App, Button, Input } from "antd";

import { SiteLogo } from "@/components/layout/site-logo";
import { usePublicSessionStore } from "@/stores/use-public-session-store";
import { type LocalUser, useUserStore } from "@/stores/use-user-store";
import { cn } from "@/lib/utils";

type AuthFormProps = {
    mode: "login" | "register";
    nextPath?: string;
    registrationEnabled?: boolean;
    emailRegistrationEnabled?: boolean;
    firstUser?: boolean;
    variant?: "page" | "embedded";
    className?: string;
    headerSlot?: ReactNode;
    authError?: string;
    initialReferralCode?: string;
    referralSource?: string;
    inviteError?: string;
};

export function AuthForm({
    mode,
    nextPath = "/create",
    registrationEnabled = true,
    emailRegistrationEnabled = false,
    firstUser = false,
    variant = "page",
    className,
    headerSlot,
    authError,
    initialReferralCode = "",
    referralSource = "registration-form",
    inviteError,
}: AuthFormProps) {
    const router = useRouter();
    const { message } = App.useApp();
    const t = useTranslations("layout");
    const site = usePublicSessionStore((state) => state.payload?.settings?.site) || { title: "JoveCanvas", logoUrl: "/logo.svg" };
    const setUser = useUserStore((state) => state.setUser);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [referralCode, setReferralCode] = useState(initialReferralCode);
    const [submitting, setSubmitting] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const isRegister = mode === "register";
    const disabled = isRegister && !registrationEnabled;
    const featureList = [t("auth.featureCommerce"), t("auth.featureCanvas"), t("auth.featureWorkbench")];

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (disabled) return;
        setSubmitting(true);
        try {
            const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, emailCode, displayName, password, referralCode: isRegister && !firstUser ? referralCode : undefined, referralSource }),
            });
            const payload = (await response.json()) as { user?: LocalUser; error?: string };
            if (!response.ok || !payload.user) throw new Error(payload.error || (isRegister ? t("auth.registerFailed") : t("auth.loginFailed")));
            setUser(payload.user);
            message.success(isRegister ? t("auth.registerSuccess") : t("auth.loginSuccess"));
            router.replace(nextPath);
            router.refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : isRegister ? t("auth.registerFailed") : t("auth.loginFailed"));
        } finally {
            setSubmitting(false);
        }
    };

    const sendEmailCode = async () => {
        setSendingCode(true);
        try {
            const response = await fetch("/api/auth/email-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ purpose: "register", email }),
            });
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error || t("auth.codeSendFailed"));
            message.success(t("auth.codeSent"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("auth.codeSendFailed"));
        } finally {
            setSendingCode(false);
        }
    };

    const form = (
        <section className={cn("auth-panel flex min-h-full items-center", variant === "embedded" ? "p-6 sm:p-7" : "p-8 sm:p-10", className)}>
            <form onSubmit={submit} className={cn("auth-form-body w-full", variant === "embedded" ? "space-y-4" : "space-y-6")}>
                {headerSlot}
                <div className="auth-form-header">
                    <p className="auth-form-kicker text-sm font-medium text-cyan-600 dark:text-cyan-300">{firstUser ? t("auth.firstSetup") : isRegister ? t("auth.createAccount") : t("auth.welcomeBack")}</p>
                    <h2 className={cn("mt-2 font-semibold tracking-normal text-stone-950 dark:text-white", variant === "embedded" ? "text-2xl" : "text-3xl")}>
                        {firstUser ? t("auth.createFirstAdmin") : isRegister ? t("auth.registerTitle", { site: site.title }) : t("auth.loginTitle", { site: site.title })}
                    </h2>
                    <p className="auth-form-description mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">{isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}</p>
                </div>

                {authError ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">{authError}</div> : null}

                {isRegister && inviteError ? <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">{inviteError}</div> : null}

                {disabled ? <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-300/20 dark:bg-cyan-300/8 dark:text-cyan-50">{t("auth.registrationDisabled")}</div> : null}

                <label className="block space-y-3">
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{isRegister ? t("auth.usernameLabel") : t("auth.usernameOrEmailLabel")}</span>
                    <Input
                        size="large"
                        prefix={<UserRound className="size-4 text-stone-500" />}
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder={isRegister ? t("auth.usernamePlaceholderRegister") : t("auth.usernamePlaceholderLogin")}
                        autoComplete="username"
                        disabled={submitting || disabled}
                        required
                    />
                    {isRegister ? <span className="block text-xs leading-5 text-stone-500 dark:text-stone-400">{t("auth.usernameHint")}</span> : null}
                </label>

                {isRegister && emailRegistrationEnabled ? (
                    <div className="space-y-3">
                        <label className="block space-y-3">
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{t("auth.emailLabel")}</span>
                            <Input
                                size="large"
                                prefix={<Mail className="size-4 text-stone-500" />}
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="admin@example.com"
                                autoComplete="email"
                                type="email"
                                disabled={submitting || disabled}
                                required
                            />
                        </label>
                        <label className="block space-y-3">
                            <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{t("auth.emailCodeLabel")}</span>
                            <Input.Search
                                size="large"
                                value={emailCode}
                                onChange={(event) => setEmailCode(event.target.value)}
                                placeholder={t("auth.emailCodePlaceholder")}
                                enterButton={sendingCode ? t("auth.sendingCode") : t("auth.getCode")}
                                loading={sendingCode}
                                disabled={submitting || disabled}
                                onSearch={() => void sendEmailCode()}
                                required
                            />
                        </label>
                    </div>
                ) : null}

                {isRegister ? (
                    <label className="block space-y-3">
                        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{t("auth.nicknameLabel")}</span>
                        <Input size="large" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t("auth.nicknamePlaceholder")} autoComplete="name" disabled={submitting || disabled} />
                    </label>
                ) : null}

                {isRegister && !firstUser ? (
                    <label className="block space-y-3">
                        <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{t("auth.referralCodeLabel")}</span>
                        <Input
                            size="large"
                            prefix={<Gift className="size-4 text-stone-500" />}
                            value={referralCode}
                            onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                            placeholder={t("auth.referralCodePlaceholder")}
                            autoComplete="off"
                            maxLength={24}
                            disabled={submitting || disabled}
                        />
                    </label>
                ) : null}

                <label className="block space-y-3">
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-200">{t("auth.passwordLabel")}</span>
                    <Input.Password
                        size="large"
                        prefix={<LockKeyhole className="size-4 text-stone-500" />}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={isRegister ? t("auth.passwordPlaceholderRegister") : t("auth.passwordPlaceholderLogin")}
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        disabled={submitting || disabled}
                        required
                    />
                </label>

                <Button className="auth-submit-button" type="primary" htmlType="submit" size="large" block loading={submitting} disabled={disabled} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                    {isRegister ? t("auth.submitRegister") : t("auth.submitLogin")}
                </Button>

                <div className="auth-switch-link pt-2 text-center text-sm text-stone-500 dark:text-stone-400">
                    {isRegister ? (
                        <>
                            {t("auth.hasAccount")}{" "}
                            <Link href="/login" className="font-medium text-stone-950 hover:underline dark:text-white">
                                {t("auth.loginNow")}
                            </Link>
                        </>
                    ) : (
                        <>
                            {t("auth.noAccount")}{" "}
                            <Link href="/register" className="font-medium text-stone-950 hover:underline dark:text-white">
                                {t("auth.registerNow")}
                            </Link>
                            <span className="mx-2 text-stone-300 dark:text-stone-700">/</span>
                            <Link href="/forgot-password" className="font-medium text-stone-950 hover:underline dark:text-white">
                                {t("auth.forgotPassword")}
                            </Link>
                        </>
                    )}
                </div>
            </form>
        </section>
    );

    if (variant === "embedded") return form;

    return (
        <main className="auth-page-bg app-scroll-page flex items-center justify-center px-4 py-6 text-foreground sm:px-6 sm:py-10">
            <div className="auth-page-card grid w-full max-w-5xl overflow-hidden border border-stone-200 bg-white/86 shadow-2xl shadow-cyan-950/10 backdrop-blur md:grid-cols-[0.9fr_1fr] dark:border-white/10 dark:bg-black/50 dark:shadow-cyan-950/20">
                <section className="auth-page-brand-panel flex min-h-[220px] flex-col justify-between gap-5 border-b border-stone-200 p-5 text-stone-950 sm:min-h-[360px] sm:gap-8 sm:p-8 md:border-b-0 md:border-r dark:border-white/10 dark:text-white">
                    <div className="flex items-start justify-between gap-4">
                        <Link href="/" className="inline-flex items-center gap-4 text-base font-semibold">
                            <SiteLogo logoUrl={site.logoUrl} className="size-16 sm:size-20" />
                            <span className="text-3xl">{site.title}</span>
                        </Link>
                        <Link
                            href="/"
                            className="auth-back-home inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-stone-200 bg-white/70 px-3 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:text-stone-950 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:border-white/20 dark:hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            <span>{t("auth.backHome")}</span>
                        </Link>
                    </div>
                    <div className="auth-page-brand-copy">
                        <h1 className="text-balance text-2xl font-semibold tracking-normal sm:text-3xl">{firstUser ? t("auth.brandTitleFirstUser") : isRegister ? t("auth.brandTitleRegister") : t("auth.brandTitleLogin")}</h1>
                    </div>
                    <div className="auth-page-feature-list grid gap-2 text-sm text-stone-600 dark:text-stone-300">
                        {featureList.map((item) => (
                            <div key={item} className="flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-cyan-400" />
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                    <p className="auth-page-brand-description max-w-sm text-sm leading-6 text-stone-500 dark:text-stone-400">{t("auth.brandDescription")}</p>
                </section>
                {form}
            </div>
        </main>
    );
}
