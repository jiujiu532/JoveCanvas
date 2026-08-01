"use client";

import { useRef, useState } from "react";

import type { CanvasBackgroundMode } from "@/lib/canvas-theme";

import type { Position, SelectionBox, ViewportTransform } from "../types";

/** 画布视口、缩放平移、框选与背景显示状态 */
export function useCanvasViewportState() {
    const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, k: 1 });
    const [size, setSize] = useState({ width: 1200, height: 720 });
    const [mouseWorld, setMouseWorld] = useState<Position>({ x: 0, y: 0 });
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
    const [backgroundMode, setBackgroundMode] = useState<CanvasBackgroundMode>("lines");
    const [showImageInfo, setShowImageInfo] = useState(false);

    const viewportRef = useRef(viewport);
    const selectionBoxRef = useRef(selectionBox);

    return {
        viewport,
        setViewport,
        size,
        setSize,
        mouseWorld,
        setMouseWorld,
        selectionBox,
        setSelectionBox,
        isMiniMapOpen,
        setIsMiniMapOpen,
        backgroundMode,
        setBackgroundMode,
        showImageInfo,
        setShowImageInfo,
        viewportRef,
        selectionBoxRef,
    };
}

export type CanvasViewportState = ReturnType<typeof useCanvasViewportState>;
