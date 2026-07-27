"use client";

import { App } from "antd";
import { useTranslations } from "next-intl";
import copy from "copy-to-clipboard";

export function useCopyText() {
    const { message } = App.useApp();
    const t = useTranslations("layout");

    return (value: string, successText = t("copiedDefault")) => {
        copy(value);
        message.success(successText);
    };
}
