import { describe, expect, it } from "vitest";

import {
    ALL_PROMPTS_OPTION,
    isAllPromptsOption,
    isSourcePromptTag,
    labelAllPromptsOption,
    labelPromptCategory,
    labelPromptTag,
    sortPromptFacetValues,
} from "@/lib/prompts/facet-labels";

describe("prompt facet labels", () => {
    it("treats legacy and sentinel all-options as unfiltered", () => {
        expect(isAllPromptsOption(ALL_PROMPTS_OPTION)).toBe(true);
        expect(isAllPromptsOption("全部")).toBe(true);
        expect(isAllPromptsOption("all")).toBe(true);
        expect(isAllPromptsOption("ui")).toBe(false);
    });

    it("labels all option and scene categories by locale", () => {
        expect(labelAllPromptsOption("zh")).toBe("全部");
        expect(labelAllPromptsOption("en")).toBe("All");
        expect(labelPromptCategory("ui", "zh")).toBe("界面");
        expect(labelPromptCategory("ui", "en")).toBe("UI");
        expect(labelPromptCategory("unknown-bucket", "zh")).toBe("unknown-bucket");
    });

    it("renames source tags and reuses scene labels for matching tags", () => {
        expect(isSourcePromptTag("youmind-skill")).toBe(true);
        expect(labelPromptTag("youmind-skill", "zh")).toContain("YouMind");
        expect(labelPromptTag("product", "zh")).toBe("产品");
        expect(labelPromptTag("老板原创", "en")).toBe("老板原创");
    });

    it("sorts facets: all first, source tags last, locale affinity", () => {
        const tags = sortPromptFacetValues(["youmind-skill", "老板原创", "cinematic", ALL_PROMPTS_OPTION], "zh", "tag");
        expect(tags[0]).toBe(ALL_PROMPTS_OPTION);
        expect(tags.indexOf("老板原创")).toBeLessThan(tags.indexOf("youmind-skill"));
        expect(tags.indexOf("youmind-skill")).toBe(tags.length - 1);

        const enTags = sortPromptFacetValues(["摄影", "cinematic", "youmind-skill", ALL_PROMPTS_OPTION], "en", "tag");
        expect(enTags[0]).toBe(ALL_PROMPTS_OPTION);
        expect(enTags.indexOf("cinematic")).toBeLessThan(enTags.indexOf("摄影"));
        expect(enTags.indexOf("youmind-skill")).toBe(enTags.length - 1);
    });
});
