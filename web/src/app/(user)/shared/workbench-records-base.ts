"use client";

import type { GenerationLogRequestSnapshot } from "@/lib/generation-log-snapshot";
import type { AiConfig } from "@/stores/use-config-store";
import { resolveClientStoreLocale } from "@/lib/client-store-locale";
import { workspaceT } from "./workspace-i18n-runtime";

/** 工作台结果槽位状态（图片/视频共用） */
export type WorkbenchGenerationStatus = "pending" | "success" | "failed";

/** 工作台日志展示状态（图片/视频共用） */
export type WorkbenchLogStatus = "成功" | "失败" | "生成中";

/** 默认文案（中文兜底）；运行时优先走 workspaceT */
export function workbenchDefaultError() {
    return workspaceT()("image.generationFailed");
}

export function workbenchDefaultTitle() {
    return workspaceT()("image.untitled");
}

/** @deprecated 请用 workbenchDefaultError()；保留常量兼容旧引用 */
export const WORKBENCH_DEFAULT_ERROR = "生成失败";
/** @deprecated 请用 workbenchDefaultTitle()；保留常量兼容旧引用 */
export const WORKBENCH_DEFAULT_TITLE = "未命名";
export const WORKBENCH_TIME_OPTIONS = { hour12: false } as const;

/** 图片/视频失败记录的公共字段 */
export type BaseGenerationFailure = {
    resultId: string;
    error: string;
};

/** 图片/视频生成结果槽位的公共字段 */
export type BaseGenerationResult = {
    id: string;
    status: WorkbenchGenerationStatus;
    error?: string;
};

/** 图片/视频生成日志的公共字段 */
export type BaseGenerationLog = {
    id: string;
    ownerUserId?: string;
    creativeConversationId?: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    durationMs: number;
    status: WorkbenchLogStatus;
    requestSnapshot?: GenerationLogRequestSnapshot;
    error?: string;
};

/** 图片/视频生成快照的公共字段 */
export type BaseGenerationSnapshot = {
    text: string;
    userText?: string;
    config: AiConfig;
};

/** 统一的本地展示时间格式（跟随 NEXT_LOCALE） */
export function formatWorkbenchTime(timestamp = Date.now(), locale?: string) {
    const appLocale = locale || resolveClientStoreLocale();
    const bcp47 = appLocale === "en" ? "en-US" : "zh-CN";
    return new Date(timestamp).toLocaleString(bcp47, WORKBENCH_TIME_OPTIONS);
}

/** 标记日志归属用户（无 userId 时原样返回） */
export function withLogOwner<T extends { ownerUserId?: string }>(log: T, userId: string): T {
    return userId ? { ...log, ownerUserId: userId } : log;
}

/** 读取服务端日志并补齐 ownerUserId */
export async function readStoredLogs<T extends { ownerUserId?: string }>(userId: string, readServerLogs: () => Promise<T[]>): Promise<T[]> {
    return (await readServerLogs()).map((log) => withLogOwner(log, userId));
}

/** 保存工作台日志（委托具体持久化实现） */
export function saveStoredLog<TLog, TResult>(log: TLog, persist: (log: TLog) => TResult): TResult {
    return persist(log);
}

/** 删除工作台日志（委托具体删除实现） */
export function removeStoredLogs<TResult>(ids: string[], remove: (ids: string[]) => TResult): TResult {
    return remove(ids);
}
