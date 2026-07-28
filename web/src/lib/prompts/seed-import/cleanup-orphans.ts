import { countLocalMediaReferences } from "@/lib/server/local-media-references";
import { deleteLocalMediaAssetsByStorageKeys } from "@/lib/server/local-media-storage";

export type CleanupUnreferencedPromptSeedCoversResult = {
    deleted: number;
    blocked: number;
};

/**
 * After a seed apply race (batch claim skipped), delete rehosted cover keys that
 * no longer have any business references (including prompts.cover_url).
 * Keys still referenced by an already-imported prompt are never deleted.
 */
export async function cleanupUnreferencedPromptSeedCovers(tokens: string[]): Promise<CleanupUnreferencedPromptSeedCoversResult> {
    const keys = Array.from(new Set(tokens.map((token) => token.trim()).filter(Boolean)));
    if (!keys.length) return { deleted: 0, blocked: 0 };

    const references = await countLocalMediaReferences(keys);
    const unreferenced: string[] = [];
    let blocked = 0;
    for (const key of keys) {
        const count = references.get(key) || 0;
        if (count > 0) {
            blocked += 1;
            continue;
        }
        unreferenced.push(key);
    }

    if (!unreferenced.length) return { deleted: 0, blocked };

    const result = await deleteLocalMediaAssetsByStorageKeys(unreferenced, "reference");
    return {
        deleted: result.deletedFiles,
        blocked: blocked + result.blocked.length,
    };
}
