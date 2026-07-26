"use client";

import { Input } from "antd";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useDramaStore } from "../stores/use-drama-store";
import type { DramaShot, DramaShotContinuity } from "../types";

export function DramaShotContinuityEditor({ projectId, episodeId, shot }: { projectId: string; episodeId: string; shot: DramaShot }) {
    const t = useTranslations("drama");
    const updateShot = useDramaStore((state) => state.updateShot);
    const [open, setOpen] = useState(false);
    const continuity = { ...emptyContinuity, ...shot.continuity };
    const updateContinuity = (key: keyof DramaShotContinuity, value: string) => updateShot(projectId, episodeId, shot.id, { continuity: { ...continuity, [key]: value } });
    const panelId = `shot-continuity-${shot.id}`;

    return (
        <div className="mt-5 border-t border-border/70 pt-4">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                className={`group grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-lg border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${open ? "border-foreground/25 bg-muted/25" : "border-border/70 bg-background hover:border-foreground/20 hover:bg-muted/25"}`}
                onClick={() => setOpen((value) => !value)}
            >
                <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-foreground transition-colors group-hover:bg-muted/80">
                        <SlidersHorizontal className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden">
                        <span className="truncate text-base font-semibold text-foreground">{t("storyboard.continuity.title")}</span>
                        <span className="truncate text-xs text-muted-foreground">{t("storyboard.continuity.subtitle")}</span>
                    </span>
                </span>
                <span
                    className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${open ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground group-hover:border-foreground/30 group-hover:bg-muted/70"}`}
                >
                    <span>{open ? t("shared.collapse") : t("storyboard.continuity.openButton")}</span>
                    <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                </span>
            </button>
            {open ? (
                <div id={panelId} className="mt-2 grid gap-3 rounded-md bg-muted/20 p-3 sm:grid-cols-2">
                    <ContinuityInput label={t("storyboard.continuity.shotSize.label")} value={continuity.shotSize} placeholder={t("storyboard.continuity.shotSize.placeholder")} onChange={(value) => updateContinuity("shotSize", value)} />
                    <ContinuityInput label={t("storyboard.continuity.cameraAngle.label")} value={continuity.cameraAngle} placeholder={t("storyboard.continuity.cameraAngle.placeholder")} onChange={(value) => updateContinuity("cameraAngle", value)} />
                    <ContinuityInput label={t("storyboard.continuity.composition.label")} value={continuity.composition} placeholder={t("storyboard.continuity.composition.placeholder")} onChange={(value) => updateContinuity("composition", value)} />
                    <ContinuityInput
                        label={t("storyboard.continuity.characterBlocking.label")}
                        value={continuity.characterBlocking}
                        placeholder={t("storyboard.continuity.characterBlocking.placeholder")}
                        onChange={(value) => updateContinuity("characterBlocking", value)}
                    />
                    <ContinuityInput
                        label={t("storyboard.continuity.gazeDirection.label")}
                        value={continuity.gazeDirection}
                        placeholder={t("storyboard.continuity.gazeDirection.placeholder")}
                        onChange={(value) => updateContinuity("gazeDirection", value)}
                    />
                    <ContinuityInput label={t("storyboard.continuity.axisRule.label")} value={continuity.axisRule} placeholder={t("storyboard.continuity.axisRule.placeholder")} onChange={(value) => updateContinuity("axisRule", value)} />
                    <ContinuityTextArea label={t("storyboard.continuity.actionStart.label")} value={continuity.actionStart} placeholder={t("storyboard.continuity.actionStart.placeholder")} onChange={(value) => updateContinuity("actionStart", value)} />
                    <ContinuityTextArea label={t("storyboard.continuity.actionEnd.label")} value={continuity.actionEnd} placeholder={t("storyboard.continuity.actionEnd.placeholder")} onChange={(value) => updateContinuity("actionEnd", value)} />
                    <ContinuityTextArea
                        label={t("storyboard.continuity.continuityNotes.label")}
                        value={continuity.continuityNotes}
                        placeholder={t("storyboard.continuity.continuityNotes.placeholder")}
                        onChange={(value) => updateContinuity("continuityNotes", value)}
                    />
                </div>
            ) : null}
        </div>
    );
}

function ContinuityInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        </label>
    );
}

function ContinuityTextArea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
    return (
        <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Input.TextArea value={value} onChange={(event) => onChange(event.target.value)} autoSize={{ minRows: 1, maxRows: 3 }} placeholder={placeholder} />
        </label>
    );
}

const emptyContinuity: DramaShotContinuity = {
    shotSize: "",
    cameraAngle: "",
    composition: "",
    characterBlocking: "",
    gazeDirection: "",
    actionStart: "",
    actionEnd: "",
    screenDirection: "",
    axisRule: "",
    continuityNotes: "",
};
