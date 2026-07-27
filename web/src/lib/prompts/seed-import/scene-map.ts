import type { SceneSlug, SeedDraft } from "@/lib/prompts/seed-import/types";
import { RARE_SCENE_ORDER, SCENE_QUOTA_SHARE, type CuratedSeed } from "@/lib/prompts/seed-import/types";

const YOUMIND_SLUG_MAP: Record<string, SceneSlug> = {
    "profile-avatar": "portrait",
    "social-media-post": "poster",
    "infographic-edu-visual": "infographic",
    "youtube-thumbnail": "poster",
    "comic-storyboard": "storyboard",
    "product-marketing": "product",
    "ecommerce-main-image": "product",
    "game-asset": "game",
    "poster-flyer": "poster",
    "app-web-design": "ui",
    others: "other",
    other: "other",
};

const KEYWORD_SCORES: Array<{ slug: SceneSlug; patterns: RegExp[] }> = [
    { slug: "ui", patterns: [/\bdashboard\b/i, /\blanding\b/i, /\bsaas\b/i, /\bui\b/i, /\bapp\b/i, /\bweb design\b/i] },
    { slug: "poster", patterns: [/\bposter\b/i, /\bflyer\b/i, /\bthumbnail\b/i, /海报/, /封面/] },
    { slug: "product", patterns: [/\bproduct\b/i, /\becommerce\b/i, /\bpackshot\b/i, /电商/, /产品/] },
    { slug: "portrait", patterns: [/\bportrait\b/i, /\bavatar\b/i, /\bcharacter\b/i, /人像/, /头像/] },
    { slug: "infographic", patterns: [/\binfographic\b/i, /信息图/] },
    { slug: "game", patterns: [/\bgame\b/i, /\bpixel\b/i, /\brpg\b/i, /游戏/] },
    { slug: "logo", patterns: [/\blogo\b/i, /\bbrand\b/i, /标志/, /品牌/] },
    { slug: "storyboard", patterns: [/\bstoryboard\b/i, /\bcinematic\b/i, /\bcomic\b/i, /分镜/] },
    { slug: "3d", patterns: [/\b3d\b/i, /\bisometric\b/i, /\bc4d\b/i, /等距/] },
    { slug: "photo", patterns: [/\bphoto\b/i, /\bphotoreal\b/i, /\bmacro\b/i, /摄影/] },
    { slug: "illustration", patterns: [/\billustration\b/i, /\bwatercolor\b/i, /插画/, /水彩/] },
];

export function mapToScene(draft: SeedDraft): SceneSlug {
    const hint = (draft.categoryHint || "").trim().toLowerCase();
    if (hint && YOUMIND_SLUG_MAP[hint]) return YOUMIND_SLUG_MAP[hint];

    const text = `${draft.title || ""}\n${(draft.tags || []).join(" ")}\n${draft.categoryHint || ""}\n${(draft.prompt || "").slice(0, 400)}`;
    const scores = new Map<SceneSlug, number>();
    for (const entry of KEYWORD_SCORES) {
        let score = 0;
        for (const pattern of entry.patterns) {
            if (pattern.test(text)) score += 1;
        }
        if (score > 0) scores.set(entry.slug, score);
    }
    if (!scores.size) return "other";

    let best: SceneSlug = "other";
    let bestScore = -1;
    // Prefer rarer scenes on ties.
    for (const slug of RARE_SCENE_ORDER) {
        const score = scores.get(slug) || 0;
        if (score > bestScore) {
            bestScore = score;
            best = slug;
        }
    }
    return bestScore > 0 ? best : "other";
}

export function sampleBySceneQuota(pool: CuratedSeed[], target: number): { accepted: CuratedSeed[]; skipped: CuratedSeed[] } {
    const safeTarget = Math.max(0, Math.floor(target));
    if (!safeTarget || !pool.length) return { accepted: [], skipped: [...pool] };

    const byScene = new Map<SceneSlug, CuratedSeed[]>();
    for (const item of pool) {
        const list = byScene.get(item.category) || [];
        list.push(item);
        byScene.set(item.category, list);
    }
    for (const list of byScene.values()) {
        list.sort((a, b) => b.prompt.length - a.prompt.length || a.title.localeCompare(b.title));
    }

    const quotas = Object.fromEntries(
        (Object.keys(SCENE_QUOTA_SHARE) as SceneSlug[]).map((slug) => {
            const raw = Math.floor(safeTarget * SCENE_QUOTA_SHARE[slug]);
            return [slug, slug === "other" ? Math.min(raw, Math.floor(safeTarget * 0.07)) : raw];
        }),
    ) as Record<SceneSlug, number>;

    // Floor leftovers go to rare scenes first so small targets still surface logo/game/etc.
    let remainingSlots = safeTarget - (Object.values(quotas) as number[]).reduce((sum, n) => sum + n, 0);
    for (const slug of RARE_SCENE_ORDER) {
        if (remainingSlots <= 0) break;
        if (slug === "other") continue;
        const available = (byScene.get(slug) || []).length;
        if (quotas[slug] < available) {
            quotas[slug] += 1;
            remainingSlots -= 1;
        }
    }

    const accepted: CuratedSeed[] = [];
    const used = new Set<string>();

    for (const slug of RARE_SCENE_ORDER) {
        const list = byScene.get(slug) || [];
        const take = Math.min(quotas[slug] || 0, list.length);
        for (let i = 0; i < take; i += 1) {
            accepted.push(list[i]);
            used.add(list[i].stableId);
            if (accepted.length >= safeTarget) break;
        }
        if (accepted.length >= safeTarget) break;
    }

    if (accepted.length < safeTarget) {
        const remaining = pool.filter((item) => !used.has(item.stableId) && item.category !== "other");
        remaining.sort((a, b) => b.prompt.length - a.prompt.length);
        for (const item of remaining) {
            accepted.push(item);
            used.add(item.stableId);
            if (accepted.length >= safeTarget) break;
        }
    }

    // Cap other again if overfilled; free slots for non-other backfill.
    const otherCap = Math.floor(safeTarget * 0.07);
    const others = accepted.filter((item) => item.category === "other");
    if (others.length > otherCap) {
        const drop = new Set(others.slice(otherCap).map((item) => item.stableId));
        for (let i = accepted.length - 1; i >= 0; i -= 1) {
            if (drop.has(accepted[i].stableId)) {
                used.delete(accepted[i].stableId);
                accepted.splice(i, 1);
            }
        }
        if (accepted.length < safeTarget) {
            const remaining = pool.filter((item) => !used.has(item.stableId) && item.category !== "other");
            remaining.sort((a, b) => b.prompt.length - a.prompt.length);
            for (const item of remaining) {
                accepted.push(item);
                used.add(item.stableId);
                if (accepted.length >= safeTarget) break;
            }
        }
    }

    const skipped = pool.filter((item) => !used.has(item.stableId));
    return { accepted: accepted.slice(0, safeTarget), skipped };
}

export function countByScene(items: Array<{ category: SceneSlug }>): Record<SceneSlug, number> {
    const counts = Object.fromEntries((Object.keys(SCENE_QUOTA_SHARE) as SceneSlug[]).map((slug) => [slug, 0])) as Record<SceneSlug, number>;
    for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
}
