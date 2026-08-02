import type { WorkbenchAgentMessage } from "@/components/agent/workbench-agent-panel";

import type { GenerationLog, GenerationResult } from "./video-workbench-records";
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
            text: log.status === "失败" ? log.error || workspaceT()("video.historyTaskFailed") : log.status === "生成中" ? workspaceT()("video.historyTaskPending") : workspaceT()("video.historyOpened"),
        },
    ];
}

/** 删除部分结果后重建 log 状态（保留任务字段仅当仍有 pending） */
export function buildLogAfterDeletingResults(currentLog: GenerationLog, nextResults: GenerationResult[]): GenerationLog {
    const keptVideos = nextResults.flatMap((result) => (result.status === "success" && result.video ? [result.video] : []));
    const keptVideo = keptVideos[keptVideos.length - 1];
    const failedResult = nextResults.find((result) => result.status === "failed");
    const pendingResult = nextResults.find((result) => result.status === "pending");
    return {
        ...currentLog,
        status: pendingResult ? "生成中" : keptVideo ? "成功" : failedResult ? "失败" : currentLog.status === "生成中" ? "失败" : currentLog.status,
        task: pendingResult ? currentLog.task : undefined,
        taskResultId: pendingResult ? currentLog.taskResultId : undefined,
        video: keptVideo,
        videos: keptVideos,
        failures: nextResults.flatMap((result) => (result.status === "failed" ? [{ resultId: result.id, error: result.error || workspaceT()("video.unknownError") }] : [])),
        error: failedResult?.error,
        resultDeleted: !nextResults.length,
    };
}

/** 活跃任务数 = 正在轮询 + 正在创建 */
export function currentVideoTaskCount(activeLogIdsSize: number, startingVideoTasks: number) {
    return activeLogIdsSize + startingVideoTasks;
}
