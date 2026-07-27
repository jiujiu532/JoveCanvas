import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { SeedDraft, SeedSourceKey } from "@/lib/prompts/seed-import/types";

export async function loadSeedDrafts(sourceKey: SeedSourceKey, inputPath: string): Promise<SeedDraft[]> {
    if (sourceKey === "youmind-skill") return loadYoumindSkill(inputPath);
    return loadGptimage2(inputPath);
}

async function loadYoumindSkill(inputPath: string): Promise<SeedDraft[]> {
    const drafts: SeedDraft[] = [];
    const files = await listJsonFiles(inputPath);
    for (const file of files) {
        if (file.endsWith("manifest.json")) continue;
        const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
        const items = Array.isArray(raw) ? raw : [];
        const categoryHint = categoryFromFilename(file);
        for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            const id = row.id;
            const content = stringField(row.content);
            const title = stringField(row.title);
            const media = stringArray(row.sourceMedia);
            if (id == null || !content || !title || !media[0]) continue;
            drafts.push({
                stableId: String(id),
                title,
                prompt: content,
                coverOriginUrl: media[0],
                tags: ["youmind-skill", categoryHint].filter(Boolean),
                categoryHint,
                preview: stringField(row.description).slice(0, 200) || undefined,
                githubUrl: "https://github.com/YouMind-OpenLab/ai-image-prompts-skill",
                sourceKey: "youmind-skill",
            });
        }
    }
    return drafts;
}

async function loadGptimage2(inputPath: string): Promise<SeedDraft[]> {
    const drafts: SeedDraft[] = [];
    const files = await listJsonFiles(inputPath);
    for (const file of files) {
        const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
        const items = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items) ? ((raw as { items: unknown[] }).items as unknown[]) : [];
        for (const item of items) {
            if (!item || typeof item !== "object") continue;
            const row = item as Record<string, unknown>;
            const id = row.id;
            const content = stringField(row.content) || stringField(row.translatedContent);
            const title = stringField(row.title);
            const media = stringArray(row.media);
            if (id == null || !content || !title || !media[0]) continue;
            const categories = stringArray(row.promptCategories);
            const language = stringField(row.language);
            drafts.push({
                stableId: String(id),
                title,
                prompt: content,
                coverOriginUrl: media[0],
                tags: ["gptimage2", ...categories].filter(Boolean),
                categoryHint: categories[0],
                preview: stringField(row.description).slice(0, 200) || undefined,
                githubUrl: stringField(row.sourceLink) || "https://github.com/gpt-image2/awesome-gptimage2-prompts",
                locale: language === "zh" || language === "en" || language === "mixed" ? language : undefined,
                sourceKey: "gptimage2-json",
            });
        }
    }
    return drafts;
}

async function listJsonFiles(inputPath: string): Promise<string[]> {
    const statHint = inputPath.toLowerCase();
    if (statHint.endsWith(".json")) return [inputPath];
    const entries = await readdir(inputPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const full = join(inputPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listJsonFiles(full)));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
            files.push(full);
        }
    }
    return files;
}

function categoryFromFilename(file: string): string {
    const base = file.replace(/\\/g, "/").split("/").pop() || "";
    return base.replace(/\.json$/i, "").replace(/\.sample\d+$/i, "");
}

function stringField(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
}
