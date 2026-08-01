import { guessPromptLocale, isPromptLocale, type PromptLocale } from "@/lib/prompts/locale-rank";
import { normalizeCoverUrl, promptContentHash, softTitleKey } from "@/lib/prompts/seed-import/normalize";
import { mapToScene } from "@/lib/prompts/seed-import/scene-map";
import type { CuratedSeed, GateDecision, SeedDraft, SkipReason } from "@/lib/prompts/seed-import/types";

const META_PROMPT_MARKERS = [
    "return only the finished image prompt",
    "return only the finished prompt",
    "convert a user's short image request",
    "do not explain the system",
    "you are a prompt engineer",
    "system prompt for creating structured image prompts",
    "write prompt content in the user's language",
];

const NSFW_KEYWORDS = ["nude", "naked", "nsfw", "porn", "xxx", "explicit sexual", "erotic", "hentai", "loli", "shota", "underage", "nude body", "全裸", "裸露", "色情", "性暗示"];

const MIN_PROMPT_LEN = 40;
const MAX_PROMPT_LEN = 4000;
const MAX_TITLE_LEN = 120;

export type DedupIndex = {
    promptHashes: Set<string>;
    /** coverKey → soft title keys already accepted */
    coverTitles: Map<string, Set<string>>;
};

export function createEmptyDedupIndex(): DedupIndex {
    return { promptHashes: new Set(), coverTitles: new Map() };
}

export function indexExistingLibrary(items: Array<{ prompt: string; coverUrl?: string; title?: string }>, index: DedupIndex = createEmptyDedupIndex()): DedupIndex {
    for (const item of items) {
        if (item.prompt) index.promptHashes.add(promptContentHash(item.prompt));
        const coverKey = normalizeCoverUrl(item.coverUrl || "");
        if (coverKey) {
            const titles = index.coverTitles.get(coverKey) || new Set<string>();
            titles.add(softTitleKey(item.title || ""));
            index.coverTitles.set(coverKey, titles);
        }
    }
    return index;
}

export function qualityGate(draft: SeedDraft): GateDecision {
    const title = (draft.title || "").trim();
    if (!title || title.length > MAX_TITLE_LEN) return skip("quality_title", draft, "title empty or too long");

    const prompt = (draft.prompt || "").trim();
    if (!prompt) return skip("quality_prompt_short", draft, "empty prompt");
    if (prompt.length < MIN_PROMPT_LEN) return skip("quality_prompt_short", draft, `len=${prompt.length}`);
    if (prompt.length > MAX_PROMPT_LEN) return skip("quality_prompt_long", draft, `len=${prompt.length}`);

    const cover = (draft.coverOriginUrl || "").trim();
    if (!cover || !/^https?:\/\//i.test(cover)) return skip("quality_cover", draft, "missing http cover");

    const lower = prompt.toLowerCase();
    if (META_PROMPT_MARKERS.some((marker) => lower.includes(marker))) return skip("quality_meta_prompt", draft);

    const haystack = `${title}\n${prompt}`.toLowerCase();
    if (NSFW_KEYWORDS.some((word) => haystack.includes(word))) return skip("quality_nsfw", draft);

    const locale = resolveLocale(draft);
    const contentHash = promptContentHash(prompt);
    const coverKey = normalizeCoverUrl(cover);
    const category = mapToScene(draft);

    const curated: CuratedSeed = {
        ...draft,
        title,
        prompt,
        coverOriginUrl: cover,
        locale,
        contentHash,
        coverKey,
        category,
        tags: Array.from(new Set((draft.tags || []).map((tag) => tag.trim()).filter(Boolean))),
    };
    return { kind: "accept", draft: curated };
}

export function dedupGate(curated: CuratedSeed, index: DedupIndex, options: { skipCoverCollision?: boolean } = {}): GateDecision {
    if (index.promptHashes.has(curated.contentHash)) return skip("prompt_hash", curated);

    const titles = index.coverTitles.get(curated.coverKey);
    if (titles) {
        const soft = softTitleKey(curated.title);
        if (titles.has(soft) || titles.has("")) return skip("cover_and_title", curated);
        if (options.skipCoverCollision !== false) return skip("cover_collision", curated);
    }

    return { kind: "accept", draft: curated };
}

/** Quality then dedup; mutates index on accept when commit=true. */
export function gateDraft(draft: SeedDraft, index: DedupIndex, options?: { commit?: boolean; skipCoverCollision?: boolean }): GateDecision {
    const quality = qualityGate(draft);
    if (quality.kind === "skip") return quality;
    const deduped = dedupGate(quality.draft, index, options);
    if (deduped.kind === "skip") return deduped;
    if (options?.commit !== false) commitAccepted(deduped.draft, index);
    return deduped;
}

export function commitAccepted(curated: CuratedSeed, index: DedupIndex) {
    index.promptHashes.add(curated.contentHash);
    const titles = index.coverTitles.get(curated.coverKey) || new Set<string>();
    titles.add(softTitleKey(curated.title));
    index.coverTitles.set(curated.coverKey, titles);
}

function resolveLocale(draft: SeedDraft): PromptLocale {
    if (isPromptLocale(draft.locale)) return draft.locale;
    return guessPromptLocale(draft.title, draft.prompt);
}

function skip(reason: SkipReason, draft?: SeedDraft, detail?: string): GateDecision {
    return { kind: "skip", reason, draft, detail };
}
