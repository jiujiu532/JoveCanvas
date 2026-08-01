"use client";

import { Form } from "antd";
import { useMemo, useRef, useState } from "react";

import type { PublicUser, PublicUserSummary, UserRole, UserStatus } from "@/lib/auth/store";

export type UserEditorValue = {
    username?: string;
    displayName: string;
    email?: string;
    password?: string;
    role: UserRole;
    status: UserStatus;
    pointsBalance: number;
};

export function useAdminUsersState(initialUsers: PublicUser[], initialUserSummary: PublicUserSummary) {
    const [userForm] = Form.useForm<UserEditorValue>();
    const userRequestIdRef = useRef(0);
    const [users, setUsers] = useState(initialUsers);
    const [userSummary, setUserSummary] = useState(initialUserSummary);
    const [usersLoading, setUsersLoading] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const [userTotal, setUserTotal] = useState(0);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const [userSearch, setUserSearch] = useState("");
    const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [bulkDeletingUsers, setBulkDeletingUsers] = useState(false);
    const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
    const [creatingUser, setCreatingUser] = useState(false);

    const stats = useMemo(
        () => ({
            total: userSummary.total,
            active: userSummary.active,
            admins: userSummary.admins,
            disabled: userSummary.disabled,
        }),
        [userSummary],
    );
    const filteredUsers = users;
    const selectedUsers = useMemo(() => users.filter((user) => selectedUserIds.includes(user.id)), [selectedUserIds, users]);

    return {
        userForm,
        userRequestIdRef,
        users,
        setUsers,
        userSummary,
        setUserSummary,
        usersLoading,
        setUsersLoading,
        userPage,
        setUserPage,
        userTotal,
        setUserTotal,
        updatingUserId,
        setUpdatingUserId,
        userSearch,
        setUserSearch,
        debouncedUserSearch,
        setDebouncedUserSearch,
        selectedUserIds,
        setSelectedUserIds,
        bulkDeletingUsers,
        setBulkDeletingUsers,
        editingUser,
        setEditingUser,
        creatingUser,
        setCreatingUser,
        stats,
        filteredUsers,
        selectedUsers,
    };
}
