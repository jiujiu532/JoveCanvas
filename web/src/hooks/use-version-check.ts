"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App } from "antd";
import { useTranslations } from "next-intl";
import { APP_VERSION } from "@/constant/env";
import { parseChangelog, type ReleaseInfo } from "@/lib/release";
import { usePublicSessionStore } from "@/stores/use-public-session-store";

const currentReleaseMajor = toVersionParts(APP_VERSION)?.[0] ?? 0;

function readLocalReleases(): ReleaseInfo[] {
    try {
        return filterCurrentReleaseLine(JSON.parse(process.env.NEXT_PUBLIC_APP_RELEASES || "[]"));
    } catch {
        return [];
    }
}

function toVersionParts(version: string) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map(Number) : null;
}

function isNewerVersion(latestVersion: string, currentVersion: string) {
    return compareVersions(latestVersion, currentVersion) > 0;
}

function compareVersions(a: string, b: string) {
    const left = toVersionParts(a);
    const right = toVersionParts(b);
    if (!left || !right) return 0;
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
}

function mergeReleases(primary: ReleaseInfo[], secondary: ReleaseInfo[]) {
    const seen = new Set<string>();
    return filterCurrentReleaseLine([...primary, ...secondary]).filter((release) => {
        if (seen.has(release.version)) return false;
        seen.add(release.version);
        return true;
    });
}

function isCurrentReleaseLine(release: ReleaseInfo) {
    if (release.version === "Unreleased") return true;
    const parts = toVersionParts(release.version);
    return Boolean(parts && parts[0] === currentReleaseMajor);
}

function filterCurrentReleaseLine(releases: ReleaseInfo[]) {
    return releases.filter(isCurrentReleaseLine);
}

export function useVersionCheck() {
    const currentVersion = APP_VERSION;
    const { message } = App.useApp();
    const t = useTranslations("layout");
    const versionCheckUrl = usePublicSessionStore((state) => state.payload?.settings?.site?.versionCheckUrl) || "";
    const configured = Boolean(versionCheckUrl);
    const latestVersionUrl = configured ? `${versionCheckUrl}/VERSION` : "";
    const latestChangelogUrl = configured ? `${versionCheckUrl}/CHANGELOG.md` : "";
    const localReleases = useMemo(readLocalReleases, []);
    const [latestVersion, setLatestVersion] = useState(currentVersion);
    const [releases, setReleases] = useState<ReleaseInfo[]>(localReleases);
    const [checking, setChecking] = useState(false);
    const [open, setOpen] = useState(false);
    const hasNewVersion = isNewerVersion(latestVersion, currentVersion);

    const checkLatestVersion = useCallback(async () => {
        if (!configured) return false;
        try {
            const response = await fetch(latestVersionUrl);
            if (!response.ok) return false;
            const version = await response.text();
            const remoteVersion = version.trim() || currentVersion;
            setLatestVersion(compareVersions(remoteVersion, currentVersion) > 0 ? remoteVersion : currentVersion);
            return true;
        } catch {
            return false;
        }
    }, [configured, currentVersion, latestVersionUrl]);

    const checkLatestRelease = useCallback(
        async (showMessage = false) => {
            if (!configured) {
                if (showMessage) message.warning(t("versionCheck.sourceNotConfigured"));
                return false;
            }
            setChecking(true);
            try {
                const [versionResponse, changelogResponse] = await Promise.all([fetch(latestVersionUrl), fetch(latestChangelogUrl)]);
                if (!versionResponse.ok) throw new Error(t("versionCheck.versionReadFailed"));
                if (!changelogResponse.ok) throw new Error(t("versionCheck.changelogReadFailed"));
                const [version, changelog] = await Promise.all([versionResponse.text(), changelogResponse.text()]);
                const remoteVersion = version.trim() || currentVersion;
                const remoteReleases = changelog.trim() ? filterCurrentReleaseLine(parseChangelog(changelog)) : [];
                const remoteIsNewer = compareVersions(remoteVersion, currentVersion) > 0;
                setLatestVersion(remoteIsNewer ? remoteVersion : currentVersion);
                setReleases(remoteIsNewer ? mergeReleases(remoteReleases, localReleases) : mergeReleases(localReleases, remoteReleases));
                if (showMessage) message.success(t("versionCheck.fetchSuccess"));
                return true;
            } catch {
                setLatestVersion(currentVersion);
                setReleases(localReleases);
                if (showMessage) message.warning(t("versionCheck.fetchFailedFallback"));
                return false;
            } finally {
                setChecking(false);
            }
        },
        [configured, currentVersion, latestChangelogUrl, latestVersionUrl, localReleases, message, t],
    );

    useEffect(() => {
        if (!configured) return;
        void checkLatestVersion();
    }, [checkLatestVersion, configured]);

    const openReleaseModal = useCallback(() => {
        setOpen(true);
        void checkLatestRelease();
    }, [checkLatestRelease]);

    return {
        open,
        setOpen,
        openReleaseModal,
        latestVersion,
        releases,
        checking,
        hasNewVersion,
        configured,
        checkLatestRelease,
    };
}
