"use client";

import { useState } from "react";

import type { ChannelHealthResult } from "@/components/admin/admin-system-channel-editor";

export function useAdminChannelsState() {
    const [fetchingModelId, setFetchingModelId] = useState("");
    const [testingChannelKey, setTestingChannelKey] = useState("");
    const [channelHealthResults, setChannelHealthResults] = useState<Record<string, ChannelHealthResult>>({});

    return {
        fetchingModelId,
        setFetchingModelId,
        testingChannelKey,
        setTestingChannelKey,
        channelHealthResults,
        setChannelHealthResults,
    };
}
