"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import copy from "copy-to-clipboard";
import { useTranslations } from "next-intl";
import { Check, Copy, Database, FileCode2, KeyRound, RefreshCw, Server, TerminalSquare, type LucideIcon } from "lucide-react";

import { buildDeploymentSnippets, generateEncryptionKey, modeOptions, type DeployMode } from "./database-config";

export function DatabaseConfigBuilder() {
    const t = useTranslations("public.install.database2");
    const [mode, setMode] = useState<DeployMode>("local");
    const [host, setHost] = useState("localhost");
    const [port, setPort] = useState("5432");
    const [database, setDatabase] = useState("vozeb_pro");
    const [username, setUsername] = useState("vozeb_pro");
    const [password, setPassword] = useState("");
    const [ssl, setSsl] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState("");
    const [copiedKey, setCopiedKey] = useState("");
    const [activeSnippet, setActiveSnippet] = useState<SnippetKey>("env");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const configurationReady = Boolean(password && encryptionKey);
    const snippets = useMemo(
        () =>
            buildDeploymentSnippets({
                mode,
                host: host.trim() || "localhost",
                port: port.trim() || "5432",
                database: database.trim() || "vozeb_pro",
                username: username.trim() || "vozeb_pro",
                password,
                ssl,
                encryptionKey,
            }),
        [database, encryptionKey, host, mode, password, port, ssl, username],
    );
    const snippetOptions: SnippetOption[] = [
        { key: "env", label: t("snippetEnvLabel"), title: mode === "local" ? t("snippetEnvTitleLocal") : t("snippetEnvTitleOther"), description: t("snippetEnvDescription"), icon: FileCode2, text: snippets.envText },
        { key: "compose", label: t("snippetComposeLabel"), title: mode === "baota" ? t("snippetComposeTitleBaota") : t("snippetComposeTitleOther"), description: t("snippetComposeDescription"), icon: Server, text: snippets.composeText },
        { key: "sql", label: t("snippetSqlLabel"), title: t("snippetSqlTitle"), description: t("snippetSqlDescription"), icon: TerminalSquare, text: snippets.sqlText },
    ];
    const selectedSnippet = snippetOptions.find((item) => item.key === activeSnippet) || snippetOptions[0];
    const modeLabels = useMemo(
        () => ({
            local: t("modes.local.label"),
            docker: t("modes.docker.label"),
            baota: t("modes.baota.label"),
            cloud: t("modes.cloud.label"),
        }),
        [t],
    );
    const modeDescriptions = useMemo(
        () => ({
            local: t("modes.local.description"),
            docker: t("modes.docker.description"),
            baota: t("modes.baota.description"),
            cloud: t("modes.cloud.description"),
        }),
        [t],
    );
    const selectedMode = modeOptions.find((item) => item.value === mode) || modeOptions[0];
    const deploymentSteps = buildDeploymentSteps(mode, t);

    useEffect(() => {
        setEncryptionKey(generateEncryptionKey());
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const changeMode = (nextMode: DeployMode) => {
        const option = modeOptions.find((item) => item.value === nextMode);
        setMode(nextMode);
        if (option) {
            setHost(option.host);
            setSsl(option.ssl);
        }
    };

    const handleCopy = (key: string, text: string) => {
        if (!configurationReady) return;
        copy(text);
        setCopiedKey(key);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopiedKey(""), 1600);
    };

    return (
        <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/78 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Database className="size-5" />
                    </span>
                    <div>
                        <div className="text-base font-semibold text-slate-950">{t("headerTitle")}</div>
                        <div className="text-xs text-slate-400">{t("headerSubtitle")}</div>
                    </div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">DATABASE_URL</div>
            </div>

            <div className="p-4">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:grid-cols-4">
                    {modeOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => changeMode(option.value)}
                            className={`h-9 rounded-md font-medium transition ${mode === option.value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                        >
                            {modeLabels[option.value]}
                        </button>
                    ))}
                </div>
                <p className="mt-3 border-l-2 border-slate-300 pl-3 text-sm leading-6 text-slate-600">{modeDescriptions[selectedMode.value]}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Host" value={host} onChange={setHost} placeholder="localhost" />
                    <Field label="Port" value={port} onChange={setPort} placeholder="5432" inputMode="numeric" />
                    <Field label="Database" value={database} onChange={setDatabase} placeholder="vozeb_pro" />
                    <Field label="User" value={username} onChange={setUsername} placeholder="vozeb_pro" />
                    <label className="block space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-medium text-slate-500">Password</span>
                        <input
                            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder={t("passwordPlaceholder")}
                        />
                    </label>
                    <label className="block space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-medium text-slate-500">Encryption Key</span>
                        <span className="flex gap-2">
                            <input className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-700 outline-none" value={encryptionKey} readOnly aria-label={t("encryptionKeyAriaLabel")} />
                            <button
                                type="button"
                                onClick={() => setEncryptionKey(generateEncryptionKey())}
                                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                                title={t("regenerateKeyTitle")}
                                aria-label={t("regenerateKeyTitle")}
                            >
                                <RefreshCw className="size-4" />
                            </button>
                        </span>
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm sm:col-span-2">
                        <span>
                            <span className="block font-medium text-slate-900">{t("sslLabel")}</span>
                            <span className="text-xs text-slate-400">{t("sslHint")}</span>
                        </span>
                        <input className="size-4 accent-slate-950" type="checkbox" checked={ssl} onChange={(event) => setSsl(event.target.checked)} />
                    </label>
                </div>

                <div className="mt-4 grid gap-x-5 border-y border-slate-200 py-2 text-xs leading-5 text-slate-500 sm:grid-cols-2">
                    <FieldNote title={t("fieldNoteHostPortTitle")} text={t("fieldNoteHostPortText")} />
                    <FieldNote title={t("fieldNoteDatabaseUserTitle")} text={t("fieldNoteDatabaseUserText")} />
                    <FieldNote title={t("fieldNotePasswordTitle")} text={t("fieldNotePasswordText")} />
                    <FieldNote title={t("fieldNoteEncryptionKeyTitle")} text={t("fieldNoteEncryptionKeyText")} />
                </div>

                <div className="mt-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-950">{t("copyConfigTitle")}</h3>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{t("copyConfigDesc")}</p>
                        </div>
                    </div>

                    {!configurationReady ? (
                        <div className="my-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-900">
                            <KeyRound className="mt-0.5 size-5 shrink-0" />
                            <div>
                                <div className="text-sm font-semibold">{t("passwordMissingTitle")}</div>
                                <p className="mt-1 text-sm leading-6 text-amber-800">{t("passwordMissingText")}</p>
                            </div>
                        </div>
                    ) : null}

                    <div className={`${configurationReady ? "mt-3" : ""} grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1`} role="tablist" aria-label={t("ariaSnippetTabs")}>
                        {snippetOptions.map((item) => {
                            const Icon = item.icon;
                            const active = item.key === selectedSnippet.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveSnippet(item.key)}
                                    className={`flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition sm:text-sm ${active ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                                >
                                    <Icon className="size-4 shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <SnippetPanel snippet={selectedSnippet} copied={copiedKey === selectedSnippet.key} disabled={!configurationReady} onCopy={() => handleCopy(selectedSnippet.key, selectedSnippet.text)} t={t} />
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5">
                    <h3 className="text-sm font-semibold text-slate-950">{t("deploymentStepsTitle", { modeLabel: modeLabels[selectedMode.value] })}</h3>
                    <ol className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        {deploymentSteps.map((step, index) => (
                            <li key={step.title} className="flex min-w-0 gap-3">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">{index + 1}</span>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">{step.text}</p>
                                    {step.command ? <code className="mt-1.5 block overflow-x-auto rounded bg-slate-100 px-2 py-1.5 font-mono text-[11px] leading-5 text-slate-700">{step.command}</code> : null}
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}

type SnippetKey = "env" | "compose" | "sql";
type Translator = ReturnType<typeof useTranslations>;

type SnippetOption = {
    key: SnippetKey;
    label: string;
    title: string;
    description: string;
    icon: LucideIcon;
    text: string;
};

function SnippetPanel({ snippet, copied, disabled, onCopy, t }: { snippet: SnippetOption; copied: boolean; disabled: boolean; onCopy: () => void; t: Translator }) {
    const Icon = snippet.icon;
    const copyButtonColor = disabled ? "#cbd5e1" : "#020617";
    return (
        <div className="mt-3 min-w-0 overflow-hidden rounded-lg bg-slate-950 text-slate-100" role="tabpanel">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-slate-300" />
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">{snippet.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{snippet.description}</span>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onCopy}
                    disabled={disabled}
                    aria-label={t("copyAriaLabel", { label: snippet.label })}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 text-xs font-semibold transition enabled:hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-700"
                    style={{ color: copyButtonColor }}
                >
                    {copied ? <Check className="size-3.5" style={{ color: copyButtonColor }} /> : <Copy className="size-3.5" style={{ color: copyButtonColor }} />}
                    <span style={{ color: copyButtonColor }}>{copied ? t("copied") : t("copy")}</span>
                </button>
            </div>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-all p-4 font-mono text-[11px] leading-5 text-slate-100 sm:text-xs">{snippet.text}</pre>
        </div>
    );
}

function FieldNote({ title, text }: { title: string; text: string }) {
    return (
        <div className="px-1 py-2">
            <span className="font-semibold text-slate-700">{title}：</span>
            {text}
        </div>
    );
}

function buildDeploymentSteps(mode: DeployMode, t: Translator) {
    if (mode === "baota") {
        return [
            { title: t("steps.baota.step1Title"), text: t("steps.baota.step1Text") },
            { title: t("steps.baota.step2Title"), text: t("steps.baota.step2Text") },
            { title: t("steps.baota.step3Title"), text: t("steps.baota.step3Text"), command: "docker compose -f docker-compose.baota.yml up -d --force-recreate" },
            { title: t("steps.baota.step4Title"), text: t("steps.baota.step4Text") },
        ];
    }
    if (mode === "docker") {
        return [
            { title: t("steps.docker.step1Title"), text: t("steps.docker.step1Text") },
            { title: t("steps.docker.step2Title"), text: t("steps.docker.step2Text") },
            { title: t("steps.docker.step3Title"), text: t("steps.docker.step3Text"), command: "docker compose up -d --force-recreate" },
            { title: t("steps.docker.step4Title"), text: t("steps.docker.step4Text") },
        ];
    }
    if (mode === "cloud") {
        return [
            { title: t("steps.cloud.step1Title"), text: t("steps.cloud.step1Text") },
            { title: t("steps.cloud.step2Title"), text: t("steps.cloud.step2Text") },
            { title: t("steps.cloud.step3Title"), text: t("steps.cloud.step3Text"), command: "docker compose -f docker-compose.external-db.yml up -d --force-recreate" },
            { title: t("steps.cloud.step4Title"), text: t("steps.cloud.step4Text") },
        ];
    }
    return [
        { title: t("steps.local.step1Title"), text: t("steps.local.step1Text") },
        { title: t("steps.local.step2Title"), text: t("steps.local.step2Text") },
        { title: t("steps.local.step3Title"), text: t("steps.local.step3Text"), command: "npm run dev" },
        { title: t("steps.local.step4Title"), text: t("steps.local.step4Text") },
    ];
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; inputMode?: "numeric" }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/10"
                value={value}
                inputMode={inputMode}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
        </label>
    );
}
