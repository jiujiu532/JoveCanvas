"use client";

import { useRef, useState } from "react";

import type { CanvasConnection, ConnectionHandle } from "../types";
import type { PendingConnectionCreate } from "./canvas-page-elements";

/** 画布连接、连线拖拽与待创建连接状态 */
export function useCanvasConnectionsState() {
    const [connections, setConnections] = useState<CanvasConnection[]>([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
    const [connectingParams, setConnectingParams] = useState<ConnectionHandle | null>(null);
    const [connectionTargetNodeId, setConnectionTargetNodeId] = useState<string | null>(null);
    const [pendingConnectionCreate, setPendingConnectionCreate] = useState<PendingConnectionCreate | null>(null);

    const connectionsRef = useRef(connections);
    const connectingParamsRef = useRef(connectingParams);
    const connectionTargetNodeIdRef = useRef(connectionTargetNodeId);
    const pendingConnectionCreateRef = useRef(pendingConnectionCreate);

    return {
        connections,
        setConnections,
        selectedConnectionId,
        setSelectedConnectionId,
        connectingParams,
        setConnectingParams,
        connectionTargetNodeId,
        setConnectionTargetNodeId,
        pendingConnectionCreate,
        setPendingConnectionCreate,
        connectionsRef,
        connectingParamsRef,
        connectionTargetNodeIdRef,
        pendingConnectionCreateRef,
    };
}

export type CanvasConnectionsState = ReturnType<typeof useCanvasConnectionsState>;
