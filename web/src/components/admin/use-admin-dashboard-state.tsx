"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { App } from "antd";

import type { AdminSectionKey } from "@/components/admin/admin-sections";
import type { AuthSettings, PublicUser, PublicUserSummary } from "@/lib/auth/store";
import type { AdminSetupSummary } from "@/lib/server/admin-setup-status";

import { useAdminChannelsState } from "./use-admin-channels-state";
import { useAdminContentState } from "./use-admin-content-state";
import { CDK_PAGE_SIZE, GENERATION_LOG_PAGE_SIZE, PROMPT_PAGE_SIZE, PROMPT_SEARCH_DEBOUNCE_MS, USER_PAGE_SIZE } from "./use-admin-dashboard-constants";
import { useAdminGenerationState } from "./use-admin-generation-state";
import { useAdminSettingsState } from "./use-admin-settings-state";
import { useAdminUsersState } from "./use-admin-users-state";

export type AdminDashboardProps = {
    initialUsers: PublicUser[];
    initialUserSummary: PublicUserSummary;
    initialSettings: AuthSettings;
    initialPromptCount: number;
    currentUser: PublicUser;
    initialSection?: AdminSectionKey;
    setupSummary?: AdminSetupSummary;
    headerActions?: ReactNode;
};

export type { PromptFormValue } from "./use-admin-content-state";
export type { UserEditorValue } from "./use-admin-users-state";
export { PROMPT_PAGE_SIZE, PROMPT_SEARCH_DEBOUNCE_MS, USER_PAGE_SIZE, CDK_PAGE_SIZE, GENERATION_LOG_PAGE_SIZE };

export function useAdminDashboardState({ initialUsers, initialUserSummary, initialSettings, initialPromptCount, currentUser, initialSection = "overview", setupSummary, headerActions }: AdminDashboardProps) {
    const { message } = App.useApp();
    const usersState = useAdminUsersState(initialUsers, initialUserSummary);
    const settingsState = useAdminSettingsState(initialSettings, usersState.userSummary, setupSummary);
    const generationState = useAdminGenerationState();
    const channelsState = useAdminChannelsState();
    const contentState = useAdminContentState(initialPromptCount);
    const [activeSection, setActiveSection] = useState<AdminSectionKey>(initialSection);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);

    return {
        initialUsers,
        initialUserSummary,
        initialSettings,
        initialPromptCount,
        currentUser,
        initialSection,
        setupSummary,
        headerActions,
        message,
        ...usersState,
        ...settingsState,
        ...generationState,
        ...channelsState,
        ...contentState,
        activeSection,
        setActiveSection,
        mobileNavOpen,
        setMobileNavOpen,
        desktopNavCollapsed,
        setDesktopNavCollapsed,
    };
}

export type AdminDashboardState = ReturnType<typeof useAdminDashboardState>;
