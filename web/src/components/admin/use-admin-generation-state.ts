"use client";

import { useMemo, useRef, useState } from "react";

import { emptyAdminGenerationOverviewSummary } from "@/lib/admin-generation-overview";
import type { GenerationAssetStats, StoredGenerationLog } from "@/lib/server/generation-log-store";

export function useAdminGenerationState() {
    const generationLogRequestIdRef = useRef(0);
    const operationsSummaryRequestIdRef = useRef(0);
    const [assetStats, setAssetStats] = useState<GenerationAssetStats | null>(null);
    const [operationsSummary, setOperationsSummary] = useState(emptyAdminGenerationOverviewSummary);
    const [operationsSummaryLoading, setOperationsSummaryLoading] = useState(false);
    const [generationLogs, setGenerationLogs] = useState<StoredGenerationLog[]>([]);
    const [generationLogTotal, setGenerationLogTotal] = useState(0);
    const [generationLogPage, setGenerationLogPage] = useState(1);
    const [generationLogSearch, setGenerationLogSearch] = useState("");
    const [generationLogKind, setGenerationLogKind] = useState("");
    const [generationLogSource, setGenerationLogSource] = useState("");
    const [generationLogStatus, setGenerationLogStatus] = useState("");
    const [generationLogUserId, setGenerationLogUserId] = useState("");
    const [generationLogStart, setGenerationLogStart] = useState("");
    const [generationLogEnd, setGenerationLogEnd] = useState("");
    const [selectedGenerationLogIds, setSelectedGenerationLogIds] = useState<string[]>([]);
    const [generationLogsLoading, setGenerationLogsLoading] = useState(false);
    const [bulkDeletingGenerationLogs, setBulkDeletingGenerationLogs] = useState(false);
    const [viewingGenerationLog, setViewingGenerationLog] = useState<StoredGenerationLog | null>(null);

    const selectedGenerationLogs = useMemo(() => generationLogs.filter((log) => selectedGenerationLogIds.includes(log.id)), [generationLogs, selectedGenerationLogIds]);

    return {
        generationLogRequestIdRef,
        operationsSummaryRequestIdRef,
        assetStats,
        setAssetStats,
        operationsSummary,
        setOperationsSummary,
        operationsSummaryLoading,
        setOperationsSummaryLoading,
        generationLogs,
        setGenerationLogs,
        generationLogTotal,
        setGenerationLogTotal,
        generationLogPage,
        setGenerationLogPage,
        generationLogSearch,
        setGenerationLogSearch,
        generationLogKind,
        setGenerationLogKind,
        generationLogSource,
        setGenerationLogSource,
        generationLogStatus,
        setGenerationLogStatus,
        generationLogUserId,
        setGenerationLogUserId,
        generationLogStart,
        setGenerationLogStart,
        generationLogEnd,
        setGenerationLogEnd,
        selectedGenerationLogIds,
        setSelectedGenerationLogIds,
        generationLogsLoading,
        setGenerationLogsLoading,
        bulkDeletingGenerationLogs,
        setBulkDeletingGenerationLogs,
        viewingGenerationLog,
        setViewingGenerationLog,
        selectedGenerationLogs,
    };
}
