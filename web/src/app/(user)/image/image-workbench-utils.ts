import { nanoid } from "nanoid";

import type { WorkbenchAgentMessage } from "@/components/agent/workbench-agent-panel";

import type { GenerationLog, GenerationResult } from "./image-workbench-records";
import { workspaceT } from "../shared/workspace-i18n-runtime";

/** 结果多选：当前可见 id / 已选可见 id / 是否全选 */
export function getResultSelectionState(results: Array<{ id: string }>, selectedResultIds: string[]) {
    const currentResultIds = results.map((result) => result.id);
    const selectedVisibleResultIds = selectedResultIds.filter((id) => currentResultIds.includes(id));
    const allResultsSelected = Boolean(results.length) && selectedVisibleResultIds.length === results.length;
    return { currentResultIds, selectedVisibleResultIds, allResultsSelected };
}

/** 勾选/取消单个结果 id */
export function nextSelectedResultIds(selectedResultIds: string[], id: string, checked: boolean) {
    return checked ? Array.from(new Set([...selectedResultIds, id])) : selectedResultIds.filter((item) => item !== id);
}

/** 模型多选（最多 max 个；再次点击取消） */
export function toggleSelectedModelIds(selectedModelIds: string[], value: string, max = 6) {
    const selected = selectedModelIds.includes(value);
    return selected ? selectedModelIds.filter((id) => id !== value) : [...selectedModelIds, value].slice(-max);
}

/** 打开历史记录时的 Agent 会话兜底消息 */
export function buildHistoryAgentFallbackMessages(log: Pick<GenerationLog, "id" | "status" | "error">, publicPrompt: string): WorkbenchAgentMessage[] {
    return [
        ...(publicPrompt ? [{ id: `history-${log.id}-user`, role: "user" as const, text: publicPrompt }] : []),
        {
            id: `history-${log.id}-assistant`,
            role: log.status === "失败" ? "error" : "assistant",
            text: log.status === "失败" ? log.error || workspaceT()("image.historyTaskFailed") : log.status === "生成中" ? workspaceT()("image.historyTaskPending") : workspaceT()("image.historyOpened"),
        },
    ];
}

/** 批量生成时创建 pending 结果槽位 */
export function createPendingGenerationResults(count: number, startIndex = 0): GenerationResult[] {
    return Array.from({ length: count }, (_, offset) => ({
        id: nanoid(),
        status: "pending" as const,
        task: undefined,
        error: undefined,
        image: undefined,
        slotIndex: startIndex + offset,
    }));
}

/** 按 resultId 合并 patch；不存在则追加 */
export function applyResultPatch(currentResults: GenerationResult[], resultId: string, patch: Partial<GenerationResult>): GenerationResult[] {
    let matched = false;
    const nextResults = currentResults.map((item) => {
        if (item.id !== resultId) return item;
        matched = true;
        return { ...item, ...patch, id: resultId };
    });
    if (!matched) {
        nextResults.push({ id: resultId, status: patch.status || "pending", ...patch });
    }
    return nextResults;
}

/** 成功但本地 URL 丢失 / 标记 missing 的可见结果 */
export function computeMissingVisibleResultIds(results: GenerationResult[], missingResultIds: string[]) {
    return results.filter((result) => result.status === "success" && result.image && (!result.image.dataUrl || missingResultIds.includes(result.id))).map((result) => result.id);
}

/** 结果列表变化后裁剪 missing id */
export function pruneMissingResultIds(results: Array<{ id: string }>, missingResultIds: string[]) {
    const visibleIds = new Set(results.map((result) => result.id));
    return missingResultIds.filter((id) => visibleIds.has(id));
}
