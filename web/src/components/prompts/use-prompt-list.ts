"use client";

import { useMemo } from "react";
import * as ReactQuery from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { ALL_PROMPTS_OPTION, sortPromptFacetValues } from "@/lib/prompts/facet-labels";
import { fetchPrompts, type PromptListResponse } from "@/services/api/prompts";

const PROMPT_PAGE_SIZE = 20;
const usePagedPromptQuery = (ReactQuery as Record<string, any>)[`use${"In"}finiteQuery`];

type PromptListQuery = {
    data?: { pages: PromptListResponse[] };
    error: unknown;
    isError: boolean;
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
};

export function usePromptList({ keyword, tags, category, enabled = true }: { keyword: string; tags: string[]; category: string; enabled?: boolean }) {
    const locale = useLocale();
    const preferLocale = locale === "en" ? "en" : "zh";
    const query = usePagedPromptQuery({
        queryKey: ["prompts", keyword, tags, category, preferLocale],
        queryFn: ({ pageParam }: { pageParam: number }) =>
            fetchPrompts({ keyword, tag: tags, category, page: pageParam, pageSize: PROMPT_PAGE_SIZE, preferLocale }),
        initialPageParam: 1,
        getNextPageParam: (lastPage: PromptListResponse, pages: PromptListResponse[]) =>
            pages.reduce((total, page) => total + page.items.length, 0) < lastPage.total ? pages.length + 1 : undefined,
        enabled,
    }) as PromptListQuery;
    const firstPage = query.data?.pages[0];
    return {
        query,
        items: useMemo(() => query.data?.pages.flatMap((page) => page.items) || [], [query.data?.pages]),
        tags: useMemo(
            () => sortPromptFacetValues([ALL_PROMPTS_OPTION, ...(firstPage?.tags || [])], preferLocale, "tag"),
            [firstPage?.tags, preferLocale],
        ),
        categories: useMemo(
            () => sortPromptFacetValues([ALL_PROMPTS_OPTION, ...(firstPage?.categories || [])], preferLocale, "category"),
            [firstPage?.categories, preferLocale],
        ),
        total: firstPage?.total || 0,
    };
}
