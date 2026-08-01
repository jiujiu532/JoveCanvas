"use client";

import { Form } from "antd";
import { useMemo, useRef, useState } from "react";

import type { CreatedCdkCode, PublicAnnouncement, PublicCdkCode } from "@/lib/auth/store";
import type { Prompt } from "@/services/api/prompts";

import { PROMPT_PAGE_SIZE } from "./use-admin-dashboard-constants";

export type PromptFormValue = {
    title: string;
    prompt: string;
    category?: string;
    tags?: string;
    coverUrl?: string;
    preview?: string;
};

export function useAdminContentState(initialPromptCount: number) {
    const [promptForm] = Form.useForm<PromptFormValue>();
    const promptRequestIdRef = useRef(0);
    const announcementRequestIdRef = useRef(0);

    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [promptCount, setPromptCount] = useState(initialPromptCount);
    const [promptListTotal, setPromptListTotal] = useState(initialPromptCount);
    const [promptSaving, setPromptSaving] = useState(false);
    const [promptsLoading, setPromptsLoading] = useState(false);
    const [deletingPromptId, setDeletingPromptId] = useState("");
    const [promptSearch, setPromptSearch] = useState("");
    const [debouncedPromptSearch, setDebouncedPromptSearch] = useState("");
    const [promptPage, setPromptPage] = useState(1);
    const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
    const [bulkDeletingPrompts, setBulkDeletingPrompts] = useState(false);
    const [promptModalOpen, setPromptModalOpen] = useState(false);

    const [viewingCdkCode, setViewingCdkCode] = useState<PublicCdkCode | null>(null);
    const [cdkCodes, setCdkCodes] = useState<PublicCdkCode[]>([]);
    const [cdkLoading, setCdkLoading] = useState(false);
    const [cdkGenerating, setCdkGenerating] = useState(false);
    const [createdCdkCodes, setCreatedCdkCodes] = useState<CreatedCdkCode[]>([]);
    const [selectedCreatedCdkIds, setSelectedCreatedCdkIds] = useState<string[]>([]);
    const [cdkForm, setCdkForm] = useState({ count: 1, points: 10, maxRedemptions: 1, expiresInDays: null as number | null, note: "" });
    const [cdkSearch, setCdkSearch] = useState("");
    const [debouncedCdkSearch, setDebouncedCdkSearch] = useState("");
    const [cdkFilter, setCdkFilter] = useState<"all" | "redeemed" | "unused" | "expired">("all");
    const [cdkPage, setCdkPage] = useState(1);
    const [cdkTotal, setCdkTotal] = useState(0);
    const [cdkStats, setCdkStats] = useState({ total: 0, redeemed: 0, unused: 0, expired: 0 });
    const [selectedCdkIds, setSelectedCdkIds] = useState<string[]>([]);
    const [bulkDeletingCdk, setBulkDeletingCdk] = useState(false);

    const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
    const [announcementPage, setAnnouncementPage] = useState(1);
    const [announcementTotal, setAnnouncementTotal] = useState(0);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [announcementSaving, setAnnouncementSaving] = useState(false);
    const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
    const [announcementDraft, setAnnouncementDraft] = useState<Partial<PublicAnnouncement>>({
        title: "",
        content: "",
        enabled: true,
        popupHome: false,
        popupAfterLogin: false,
    });

    const selectedPrompts = useMemo(() => prompts.filter((prompt) => selectedPromptIds.includes(prompt.id)), [prompts, selectedPromptIds]);
    const promptListStart = promptListTotal ? (promptPage - 1) * PROMPT_PAGE_SIZE + 1 : 0;
    const promptListEnd = Math.min(promptPage * PROMPT_PAGE_SIZE, promptListTotal);
    const selectedCreatedCdkCodes = useMemo(() => createdCdkCodes.filter((code) => selectedCreatedCdkIds.includes(code.id)), [createdCdkCodes, selectedCreatedCdkIds]);
    const createdCdkActionCodes = selectedCreatedCdkCodes.length ? selectedCreatedCdkCodes : createdCdkCodes;
    const allCreatedCdkSelected = Boolean(createdCdkCodes.length) && selectedCreatedCdkIds.length === createdCdkCodes.length;

    return {
        promptForm,
        promptRequestIdRef,
        announcementRequestIdRef,
        prompts,
        setPrompts,
        promptCount,
        setPromptCount,
        promptListTotal,
        setPromptListTotal,
        promptSaving,
        setPromptSaving,
        promptsLoading,
        setPromptsLoading,
        deletingPromptId,
        setDeletingPromptId,
        promptSearch,
        setPromptSearch,
        debouncedPromptSearch,
        setDebouncedPromptSearch,
        promptPage,
        setPromptPage,
        selectedPromptIds,
        setSelectedPromptIds,
        bulkDeletingPrompts,
        setBulkDeletingPrompts,
        promptModalOpen,
        setPromptModalOpen,
        viewingCdkCode,
        setViewingCdkCode,
        cdkCodes,
        setCdkCodes,
        cdkLoading,
        setCdkLoading,
        cdkGenerating,
        setCdkGenerating,
        createdCdkCodes,
        setCreatedCdkCodes,
        selectedCreatedCdkIds,
        setSelectedCreatedCdkIds,
        cdkForm,
        setCdkForm,
        cdkSearch,
        setCdkSearch,
        debouncedCdkSearch,
        setDebouncedCdkSearch,
        cdkFilter,
        setCdkFilter,
        cdkPage,
        setCdkPage,
        cdkTotal,
        setCdkTotal,
        cdkStats,
        setCdkStats,
        selectedCdkIds,
        setSelectedCdkIds,
        bulkDeletingCdk,
        setBulkDeletingCdk,
        announcements,
        setAnnouncements,
        announcementPage,
        setAnnouncementPage,
        announcementTotal,
        setAnnouncementTotal,
        announcementsLoading,
        setAnnouncementsLoading,
        announcementSaving,
        setAnnouncementSaving,
        announcementModalOpen,
        setAnnouncementModalOpen,
        announcementDraft,
        setAnnouncementDraft,
        selectedPrompts,
        promptListStart,
        promptListEnd,
        selectedCreatedCdkCodes,
        createdCdkActionCodes,
        allCreatedCdkSelected,
    };
}
