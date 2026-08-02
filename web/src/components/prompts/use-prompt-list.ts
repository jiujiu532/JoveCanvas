"use client";

import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { ALL_PROMPTS_OPTION, fetchPrompts, type PromptListResponse } from "@/services/api/prompts";

const PROMPT_PAGE_SIZE = 20;

function resolveClientPreferLocale(locale: string): "zh" | "en" {
    return locale === "en" ? "en" : "zh";
}

export function usePromptList({ keyword, tags, category, enabled = true }: { keyword: string; tags: string[]; category: string; enabled?: boolean }) {
    const preferLocale = resolveClientPreferLocale(useLocale());
    const query = useInfiniteQuery({
        queryKey: ["prompts", keyword, tags, category, preferLocale],
        queryFn: ({ pageParam }: { pageParam: number }) => fetchPrompts({ keyword, tag: tags, category, page: pageParam, pageSize: PROMPT_PAGE_SIZE, preferLocale }),
        initialPageParam: 1,
        getNextPageParam: (lastPage: PromptListResponse, pages: PromptListResponse[]) => (pages.reduce((total, page) => total + page.items.length, 0) < lastPage.total ? pages.length + 1 : undefined),
        enabled,
    });
    const firstPage = query.data?.pages[0];
    return {
        query,
        items: useMemo(() => query.data?.pages.flatMap((page) => page.items) || [], [query.data?.pages]),
        tags: useMemo(() => [ALL_PROMPTS_OPTION, ...(firstPage?.tags || [])], [firstPage?.tags]),
        categories: useMemo(() => [ALL_PROMPTS_OPTION, ...(firstPage?.categories || [])], [firstPage?.categories]),
        total: firstPage?.total || 0,
    };
}

export function usePromptPage({ keyword, tag, category, page, pageSize = 16 }: { keyword: string; tag: string; category: string; page: number; pageSize?: number }) {
    const preferLocale = resolveClientPreferLocale(useLocale());
    const query = useQuery({
        queryKey: ["prompts", "page", keyword, tag, category, page, pageSize, preferLocale],
        queryFn: () =>
            fetchPrompts({
                keyword,
                tag: tag === ALL_PROMPTS_OPTION ? [] : [tag],
                category,
                page,
                pageSize,
                preferLocale,
            }),
        placeholderData: (previous) => previous,
    });
    return {
        query,
        items: query.data?.items || [],
        tags: [ALL_PROMPTS_OPTION, ...(query.data?.tags || [])],
        categories: [ALL_PROMPTS_OPTION, ...(query.data?.categories || [])],
        total: query.data?.total || 0,
    };
}
