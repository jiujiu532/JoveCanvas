"use client";

import { useEffect, useRef, useState } from "react";
import { App } from "antd";
import { useTranslations } from "next-intl";

import type { CanvasAgentOp, CanvasAgentSnapshot } from "./utils/canvas-agent-ops";

type CanvasAgentConnection = { endpoint: string; token: string };
type CanvasAgentToolCall = { requestId: string; name: string; input?: { ops?: CanvasAgentOp[] } };
type CanvasAgentTranslate = (key: string, values?: Record<string, string | number>) => string;

export function useCanvasLocalAgentBridge({ snapshot, onApplyOps }: { snapshot: CanvasAgentSnapshot; onApplyOps: (ops?: CanvasAgentOp[]) => CanvasAgentSnapshot }) {
    const { message, modal } = App.useApp();
    const t = useTranslations("canvas.agent");
    const tRef = useRef(t);
    tRef.current = t;
    const [connection] = useState(() => resolveCanvasAgentConnection(typeof window === "undefined" ? "" : window.location.search));
    const [connected, setConnected] = useState(false);
    const snapshotRef = useRef(snapshot);
    const applyOpsRef = useRef(onApplyOps);
    const notifiedRef = useRef(false);
    const clientIdRef = useRef(typeof crypto === "undefined" ? `${Date.now()}` : crypto.randomUUID());
    snapshotRef.current = snapshot;
    applyOpsRef.current = onApplyOps;

    useEffect(() => {
        if (!connection) return;
        const { endpoint, token } = connection;
        const clientId = clientIdRef.current;
        const source = new EventSource(`${endpoint}/events?token=${encodeURIComponent(token)}&clientId=${encodeURIComponent(clientId)}`);
        source.addEventListener("hello", () => {
            setConnected(true);
            void postCanvasAgentState(connection, clientId, snapshotRef.current, tRef.current);
            removeCanvasAgentCredentialsFromUrl();
            if (!notifiedRef.current) {
                notifiedRef.current = true;
                message.success(tRef.current("connected"));
            }
        });
        source.addEventListener("tool_call", (event) => {
            const call = parseToolCall(event);
            if (!call) return;
            void handleToolCall(call, connection, clientId, snapshotRef, applyOpsRef, (ops) => confirmCanvasOps(modal, ops, tRef.current), tRef.current);
        });
        source.onerror = () => {
            setConnected(false);
            if (!notifiedRef.current) message.warning(tRef.current("connectFailed"));
        };
        return () => {
            setConnected(false);
            source.close();
        };
    }, [connection, message, modal]);

    useEffect(() => {
        if (!connection || !connected) return;
        const timer = window.setTimeout(() => void postCanvasAgentState(connection, clientIdRef.current, snapshot, tRef.current), 300);
        return () => window.clearTimeout(timer);
    }, [connected, connection, snapshot]);
}

export function resolveCanvasAgentConnection(search: string): CanvasAgentConnection | null {
    const params = new URLSearchParams(search);
    const endpoint = params.get("agentUrl")?.trim().replace(/\/+$/, "") || "";
    const token = params.get("agentToken")?.trim() || "";
    if (!endpoint || token.length < 16 || token.length > 256) return null;
    try {
        const url = new URL(endpoint);
        const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(hostname)) return null;
        return { endpoint: url.origin, token };
    } catch {
        return null;
    }
}

export async function executeCanvasAgentToolCall(call: CanvasAgentToolCall, snapshot: CanvasAgentSnapshot, applyOps: (ops?: CanvasAgentOp[]) => CanvasAgentSnapshot, confirmOps: (ops: CanvasAgentOp[]) => Promise<boolean>, t: CanvasAgentTranslate) {
    if (call.name === "canvas_get_state" || call.name === "canvas_export_snapshot") return snapshot;
    if (call.name === "canvas_get_selection") {
        const selected = new Set(snapshot.selectedNodeIds);
        return { nodes: snapshot.nodes.filter((node) => selected.has(node.id)) };
    }
    if (call.name !== "canvas_apply_ops") throw new Error(t("unsupportedTool", { name: call.name }));
    const ops = Array.isArray(call.input?.ops) ? call.input.ops.filter((op) => Boolean(op?.type)) : [];
    if (!ops.length) throw new Error(t("noValidOps"));
    if (!(await confirmOps(ops))) throw new Error(t("opsRejected"));
    return applyOps(ops);
}

async function handleToolCall(
    call: CanvasAgentToolCall,
    connection: CanvasAgentConnection,
    clientId: string,
    snapshotRef: { current: CanvasAgentSnapshot },
    applyOpsRef: { current: (ops?: CanvasAgentOp[]) => CanvasAgentSnapshot },
    confirmOps: (ops: CanvasAgentOp[]) => Promise<boolean>,
    t: CanvasAgentTranslate,
) {
    try {
        const result = await executeCanvasAgentToolCall(call, snapshotRef.current, applyOpsRef.current, confirmOps, t);
        await postCanvasAgentResult(connection, clientId, { requestId: call.requestId, result }, t);
        if (call.name === "canvas_apply_ops") await postCanvasAgentState(connection, clientId, result as CanvasAgentSnapshot, t);
    } catch (error) {
        await postCanvasAgentResult(connection, clientId, { requestId: call.requestId, error: error instanceof Error ? error.message : t("opFailed") }, t);
    }
}

function parseToolCall(event: Event): CanvasAgentToolCall | null {
    try {
        const value = JSON.parse((event as MessageEvent<string>).data) as CanvasAgentToolCall;
        return value?.requestId && value?.name ? value : null;
    } catch {
        return null;
    }
}

function confirmCanvasOps(modal: ReturnType<typeof App.useApp>["modal"], ops: CanvasAgentOp[], t: CanvasAgentTranslate) {
    return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        modal.confirm({
            title: t("confirmTitle"),
            content: t("confirmContent", { count: ops.length }),
            okText: t("allow"),
            cancelText: t("reject"),
            onOk: () => finish(true),
            onCancel: () => finish(false),
            afterClose: () => finish(false),
        });
    });
}

function postCanvasAgentState(connection: CanvasAgentConnection, clientId: string, snapshot: CanvasAgentSnapshot, t: CanvasAgentTranslate) {
    return postCanvasAgentJson(connection, `/canvas/state?clientId=${encodeURIComponent(clientId)}`, snapshot, t);
}

function postCanvasAgentResult(connection: CanvasAgentConnection, clientId: string, body: { requestId: string; result?: unknown; error?: string }, t: CanvasAgentTranslate) {
    return postCanvasAgentJson(connection, `/canvas/result?clientId=${encodeURIComponent(clientId)}`, body, t);
}

async function postCanvasAgentJson(connection: CanvasAgentConnection, path: string, body: unknown, t: CanvasAgentTranslate) {
    const response = await fetch(`${connection.endpoint}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(connection.token)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(t("requestFailed"));
}

function removeCanvasAgentCredentialsFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("agentUrl");
    url.searchParams.delete("agentToken");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
