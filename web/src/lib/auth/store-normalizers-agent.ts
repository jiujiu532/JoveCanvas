import { randomUUID } from "node:crypto";

import { ECOMMERCE_IMAGE_SKILL } from "@/lib/server/agent-skills/ecommerce-image";
import { YANAI_BEAUTY_SKILL } from "@/lib/server/agent-skills/yanai-beauty";
import { DEFAULT_CREATIVE_SHORTCUT_SKILLS } from "@/lib/server/agent-skills/creative-shortcuts";

import { DEFAULT_SETTINGS } from "./store-foundation";
import type { AgentSkill } from "./store-types";

export function normalizeAgentSkill(skill: AgentSkill): AgentSkill {
    if (skill.id === ECOMMERCE_IMAGE_SKILL.id && !skill.sourceUrl) return { ...ECOMMERCE_IMAGE_SKILL, keywords: [...ECOMMERCE_IMAGE_SKILL.keywords], workspaces: [...ECOMMERCE_IMAGE_SKILL.workspaces], enabled: skill.enabled !== false };
    const instructions = String(skill.instructions || "")
        .trim()
        .slice(0, 8000);
    return {
        id: String(skill.id || randomUUID()),
        name: String(skill.name || "")
            .trim()
            .slice(0, 60),
        description: String(skill.description || "")
            .trim()
            .slice(0, 240),
        plannerSummary:
            String(skill.plannerSummary || skill.description || instructions)
                .trim()
                .slice(0, 240) || undefined,
        instructions,
        enabled: skill.enabled !== false,
        keywords: Array.isArray(skill.keywords)
            ? skill.keywords
                  .map(String)
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .slice(0, 30)
            : [],
        workspaces: Array.isArray(skill.workspaces) ? skill.workspaces.filter((item): item is "image" | "video" | "canvas" | "drama" => ["image", "video", "canvas", "drama"].includes(item)) : ["image"],
        action: skill.action === "edit" ? "edit" : "generate",
        requiresReference: Boolean(skill.requiresReference),
        defaultConfig: skill.defaultConfig && typeof skill.defaultConfig === "object" ? skill.defaultConfig : {},
        sourceUrl:
            String(skill.sourceUrl || "")
                .trim()
                .slice(0, 500) || undefined,
        sourceVersion:
            String(skill.sourceVersion || "")
                .trim()
                .slice(0, 40) || undefined,
        license:
            String(skill.license || "")
                .trim()
                .slice(0, 40) || undefined,
    };
}

export function normalizeAgentSkills(skills: AgentSkill[] | undefined) {
    const normalized = Array.isArray(skills) ? skills.map(normalizeAgentSkill).filter((skill) => skill.name && skill.instructions) : [...DEFAULT_SETTINGS.agentSkills];
    if (!normalized.some((skill) => skill.id === YANAI_BEAUTY_SKILL.id)) normalized.push({ ...YANAI_BEAUTY_SKILL, keywords: [...YANAI_BEAUTY_SKILL.keywords], workspaces: [...YANAI_BEAUTY_SKILL.workspaces] });
    for (const skill of DEFAULT_CREATIVE_SHORTCUT_SKILLS) {
        const index = normalized.findIndex((item) => item.id === skill.id);
        if (index < 0) normalized.push({ ...skill, keywords: [...skill.keywords], workspaces: [...skill.workspaces] });
        else normalized[index] = { ...normalized[index], workspaces: [...new Set([...skill.workspaces, ...(normalized[index].workspaces || [])])] };
    }
    return normalized;
}
