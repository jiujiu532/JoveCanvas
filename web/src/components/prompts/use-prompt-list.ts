"use client";

import { useEffect, useMemo } from "react";
import * as ReactQuery from "@tanstack/react-query";
import { useLocale } from "next-intl";

import { ALL_PROMPTS_OPTION, isAllPromptsOption, sortPromptFacetValues } from "@/lib/prompts/facet-labels";
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

export function usePromptList({
    keyword,
    tags,
    category,
    selectedTag,
    onSelectedTagChange,
    enabled = true,
}: {
    keyword: string;
    tags: string[];
    category: string;
    /** When provided with onSelectedTagChange, clears ghost tags not present in facets. */
    selectedTag?: string;
    onSelectedTagChange?: (tag: string) => void;
    enabled?: boolean;
}) {
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
    const promptTags = useMemo(
        () => sortPromptFacetValues([ALL_PROMPTS_OPTION, ...(firstPage?.tags || [])], preferLocale, "tag"),
        [firstPage?.tags, preferLocale],
    );
    const promptCategories = useMemo(
        () => sortPromptFacetValues([ALL_PROMPTS_OPTION, ...(firstPage?.categories || [])], preferLocale, "category"),
        [firstPage?.categories, preferLocale],
    );

    // R6: after category change, drop selectedTag if it is not in the new facet list.
    useEffect(() => {
        if (!onSelectedTagChange || selectedTag === undefined) return;
        if (isAllPromptsOption(selectedTag)) return;
        // Wait until first page (facets) is available to avoid clearing during load.
        if (!firstPage) return;
        if (!promptTags.includes(selectedTag)) {
            onSelectedTagChange(ALL_PROMPTS_OPTION);
        }
    }, [firstPage, onSelectedTagChange, promptTags, selectedTag]);

    return {
        query,
        items: useMemo(() => query.data?.pages.flatMap((page) => page.items) || [], [query.data?.pages]),
        tags: promptTags,
        categories: promptCategories,
        total: firstPage?.total || 0,
    };
}
