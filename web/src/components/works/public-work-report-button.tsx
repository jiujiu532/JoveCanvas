"use client";

import { App, Button, Input, Modal, Select } from "antd";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { submitWorkReport } from "@/services/api/work-governance";
import { useUserStore } from "@/stores/use-user-store";

const REPORT_CATEGORY_VALUES = ["illegal", "copyright", "privacy", "spam", "other"] as const;

export function PublicWorkReportButton({ slug, compact = false, className }: { slug: string; compact?: boolean; className?: string }) {
    const t = useTranslations("public.works.report");
    const { message } = App.useApp();
    const router = useRouter();
    const user = useUserStore((state) => state.user);
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<(typeof REPORT_CATEGORY_VALUES)[number]>("illegal");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const reportOptions = useMemo(
        () => [
            { value: "illegal", label: t("categoryIllegal") },
            { value: "copyright", label: t("categoryCopyright") },
            { value: "privacy", label: t("categoryPrivacy") },
            { value: "spam", label: t("categorySpam") },
            { value: "other", label: t("categoryOther") },
        ],
        [t],
    );

    const startReport = () => {
        if (!user) {
            router.push(`/login?next=${encodeURIComponent(`/share/${slug}`)}`);
            return;
        }
        setOpen(true);
    };

    const submit = async () => {
        if (description.trim().length < 5) return message.warning(t("minDescription"));
        setLoading(true);
        try {
            await submitWorkReport(slug, { category, description: description.trim() });
            message.success(t("submitSuccess"));
            setOpen(false);
            setDescription("");
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("submitFailed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button className={className} size={compact ? "small" : "middle"} icon={<Flag className="size-4" />} onClick={startReport} aria-label={t("reportAria")}>
                {compact ? null : t("report")}
            </Button>
            <Modal title={t("title")} open={open} okText={t("submit")} cancelText={t("cancel")} confirmLoading={loading} okButtonProps={{ disabled: description.trim().length < 5 }} onOk={() => void submit()} onCancel={() => !loading && setOpen(false)}>
                <div className="grid gap-4 pt-2">
                    <div>
                        <div className="mb-2 text-sm font-medium">{t("categoryLabel")}</div>
                        <Select className="w-full" value={category} options={reportOptions} onChange={setCategory} />
                    </div>
                    <div>
                        <div className="mb-2 text-sm font-medium">{t("descriptionLabel")}</div>
                        <Input.TextArea value={description} rows={5} maxLength={1000} showCount placeholder={t("descriptionPlaceholder")} onChange={(event) => setDescription(event.target.value)} />
                    </div>
                </div>
            </Modal>
        </>
    );
}
