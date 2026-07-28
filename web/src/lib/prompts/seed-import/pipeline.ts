import { loadSeedDrafts } from "@/lib/prompts/seed-import/adapters";
import { createEmptyDedupIndex, gateDraft, indexExistingLibrary } from "@/lib/prompts/seed-import/gates";
import { rehostPromptCover } from "@/lib/prompts/seed-import/rehost";
import { countByScene, sampleBySceneQuota } from "@/lib/prompts/seed-import/scene-map";
import { SEED_SOURCE_META, type CuratedSeed, type SeedSourceKey, type SkipReason } from "@/lib/prompts/seed-import/types";
import { isLibrarySeedSourceRegistered, type StoredPromptExport } from "@/lib/prompts/store";

export type ImportReport = {
    sourceKey: SeedSourceKey;
    source: string;
    sourcePrefix: string;
    scanned: number;
    accepted: number;
    skipped: Record<string, number>;
    sceneCounts: Record<string, number>;
    localeCounts: Record<string, number>;
    samples: { accept: Array<{ id: string; title: string; category: string }>; skip: Array<{ reason: string; title?: string }> };
    prompts: StoredPromptExport[];
    /** Storage keys successfully rehosted in this run (for orphan cleanup if apply claim races). */
    rehostedTokens: string[];
};

export type RunImportOptions = {
    sourceKey: SeedSourceKey;
    inputPath: string;
    library: Array<{ prompt: string; coverUrl?: string; title?: string }>;
    target?: number;
    /** true = no DB write (caller responsibility); rehost default off unless skipRehost=false */
    dryRun?: boolean;
    allowExternalCover?: boolean;
    skipRehost?: boolean;
    /**
     * When true, if the versioned source is already registered, return immediately
     * without rehost downloads (idempotent apply guard).
     * Uses `registeredSeedSources` when provided; otherwise queries store.
     */
    skipIfSourceRegistered?: boolean;
    /** Optional preloaded seedSources list (avoids DB in tests). */
    registeredSeedSources?: string[];
    existingIndex?: ReturnType<typeof createEmptyDedupIndex>;
    now?: string;
};

export async function runSeedImport(options: RunImportOptions): Promise<ImportReport> {
    const meta = SEED_SOURCE_META[options.sourceKey];
    const now = options.now || new Date().toISOString();
    const target = options.target ?? meta.targetMax;
    const isDryRun = options.dryRun !== false;
    const skipRehost = options.skipRehost ?? isDryRun;

    if (options.skipIfSourceRegistered) {
        const registered =
            options.registeredSeedSources !== undefined
                ? options.registeredSeedSources.includes(meta.source)
                : await isLibrarySeedSourceRegistered(meta.source);
        if (registered) {
            return {
                sourceKey: options.sourceKey,
                source: meta.source,
                sourcePrefix: meta.sourcePrefix,
                scanned: 0,
                accepted: 0,
                skipped: { source_registered: 1 },
                sceneCounts: {},
                localeCounts: {},
                samples: { accept: [], skip: [{ reason: "source_registered" }] },
                prompts: [],
                rehostedTokens: [],
            };
        }
    }

    const index = options.existingIndex || indexExistingLibrary(options.library, createEmptyDedupIndex());
    const drafts = await loadSeedDrafts(options.sourceKey, options.inputPath);

    const skipCounts: Record<string, number> = {};
    const skipSamples: Array<{ reason: string; title?: string }> = [];
    const pool: CuratedSeed[] = [];

    for (const draft of drafts) {
        const decision = gateDraft(draft, index, { commit: true });
        if (decision.kind === "skip") {
            bump(skipCounts, decision.reason);
            if (skipSamples.length < 12) skipSamples.push({ reason: decision.reason, title: decision.draft?.title });
            continue;
        }
        pool.push(decision.draft);
    }

    const { accepted: sampled, skipped: quotaSkipped } = sampleBySceneQuota(pool, target);
    for (const _item of quotaSkipped) bump(skipCounts, "quota" satisfies SkipReason);

    const prompts: StoredPromptExport[] = [];
    const acceptSamples: Array<{ id: string; title: string; category: string }> = [];
    const rehostedTokens: string[] = [];

    for (const item of sampled) {
        let coverUrl = item.coverOriginUrl;
        if (!skipRehost) {
            const rehosted = await rehostPromptCover(item.coverOriginUrl, meta.mediaSource);
            if (!rehosted.ok) {
                if (options.allowExternalCover) {
                    coverUrl = item.coverOriginUrl;
                } else {
                    bump(skipCounts, "rehost");
                    if (skipSamples.length < 12) skipSamples.push({ reason: "rehost", title: item.title });
                    continue;
                }
            } else {
                coverUrl = rehosted.coverUrl;
                if (rehosted.token) rehostedTokens.push(rehosted.token);
            }
        } else if (!isDryRun && !options.allowExternalCover) {
            bump(skipCounts, "rehost");
            if (skipSamples.length < 12) skipSamples.push({ reason: "rehost", title: item.title });
            continue;
        }

        const id = `${meta.idPrefix}${item.stableId}`;
        const stored: StoredPromptExport = {
            id,
            scope: "library",
            title: item.title,
            coverUrl,
            prompt: item.prompt,
            tags: Array.from(new Set([...(item.tags || []), item.category, options.sourceKey])),
            category: item.category,
            preview: item.preview || item.title,
            githubUrl: item.githubUrl,
            source: meta.source,
            locale: item.locale,
            createdAt: now,
            updatedAt: now,
        };
        prompts.push(stored);
        if (acceptSamples.length < 8) acceptSamples.push({ id, title: item.title, category: item.category });
    }

    const sceneCounts = countByScene(prompts.map((item) => ({ category: item.category as CuratedSeed["category"] })));
    const localeCounts: Record<string, number> = {};
    for (const item of prompts) bump(localeCounts, item.locale || "unknown");

    return {
        sourceKey: options.sourceKey,
        source: meta.source,
        sourcePrefix: meta.sourcePrefix,
        scanned: drafts.length,
        accepted: prompts.length,
        skipped: skipCounts,
        sceneCounts,
        localeCounts,
        samples: { accept: acceptSamples, skip: skipSamples },
        prompts,
        rehostedTokens,
    };
}

function bump(map: Record<string, number>, key: string) {
    map[key] = (map[key] || 0) + 1;
}
