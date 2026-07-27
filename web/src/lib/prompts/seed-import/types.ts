import type { PromptLocale } from "@/lib/prompts/locale-rank";

export type SeedSourceKey = "youmind-skill" | "gptimage2-json";

export type SceneSlug =
    | "portrait"
    | "poster"
    | "product"
    | "ui"
    | "infographic"
    | "illustration"
    | "photo"
    | "3d"
    | "storyboard"
    | "game"
    | "logo"
    | "other";

export type SeedDraft = {
    stableId: string;
    title: string;
    prompt: string;
    coverOriginUrl: string;
    tags: string[];
    /** Upstream category signal (before scene map). */
    categoryHint?: string;
    preview?: string;
    githubUrl?: string;
    locale?: PromptLocale;
    sourceKey: SeedSourceKey;
};

export type SkipReason =
    | "quality_title"
    | "quality_prompt_short"
    | "quality_prompt_long"
    | "quality_cover"
    | "quality_meta_prompt"
    | "quality_nsfw"
    | "prompt_hash"
    | "cover_and_title"
    | "cover_collision"
    | "quota"
    | "rehost"
    | "other";

export type CuratedSeed = SeedDraft & {
    category: SceneSlug;
    locale: PromptLocale;
    contentHash: string;
    coverKey: string;
};

export type AcceptDecision = {
    kind: "accept";
    draft: CuratedSeed;
};

export type SkipDecision = {
    kind: "skip";
    reason: SkipReason;
    draft?: SeedDraft;
    detail?: string;
};

export type GateDecision = AcceptDecision | SkipDecision;

export const SEED_SOURCE_META: Record<
    SeedSourceKey,
    { sourcePrefix: string; source: string; idPrefix: string; mediaSource: string; targetMin: number; targetMax: number }
> = {
    "youmind-skill": {
        sourcePrefix: "vozeb-pro/youmind-skill",
        source: "vozeb-pro/youmind-skill:v1",
        idPrefix: "youmind-skill-",
        mediaSource: "prompt-seed:youmind-skill",
        targetMin: 300,
        targetMax: 500,
    },
    "gptimage2-json": {
        sourcePrefix: "vozeb-pro/gptimage2-json",
        source: "vozeb-pro/gptimage2-json:v1",
        idPrefix: "gptimage2-",
        mediaSource: "prompt-seed:gptimage2",
        targetMin: 200,
        targetMax: 400,
    },
};

export const SCENE_QUOTA_SHARE: Record<SceneSlug, number> = {
    portrait: 0.12,
    poster: 0.1,
    product: 0.1,
    ui: 0.12,
    infographic: 0.08,
    illustration: 0.1,
    photo: 0.08,
    "3d": 0.08,
    storyboard: 0.06,
    game: 0.05,
    logo: 0.04,
    other: 0.07,
};

export const RARE_SCENE_ORDER: SceneSlug[] = ["logo", "game", "storyboard", "infographic", "3d", "photo", "portrait", "product", "poster", "illustration", "ui", "other"];
