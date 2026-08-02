import { App } from "antd";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CreativeAsset, CreativeMessage } from "@/lib/creative-runtime-contract";
import type { CreativeAgentRun } from "@/services/api/creative";

import enWorkspace from "../../../../../messages/en/workspace.json";
import zhWorkspace from "../../../../../messages/zh/workspace.json";
import { CreativeMessages } from "./creative-messages";

const zhMessages = { workspace: zhWorkspace };
const enMessages = { workspace: enWorkspace };
const tZh = createTranslator({ locale: "zh", messages: zhMessages, namespace: "workspace.create.messages" });
const tEn = createTranslator({ locale: "en", messages: enMessages, namespace: "workspace.create.messages" });

function renderCreativeMessages(
    props: {
        messages: CreativeMessage[];
        assets?: CreativeAsset[];
        runDetails?: Record<string, CreativeAgentRun>;
    },
    locale: "zh" | "en" = "zh",
) {
    const messages = locale === "en" ? enMessages : zhMessages;
    return renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages}>
            <App>
                <CreativeMessages
                    messages={props.messages}
                    assets={props.assets || []}
                    loading={false}
                    projectLinks={{}}
                    projectErrors={{}}
                    runDetails={props.runDetails || {}}
                    onMaterializeProject={async () => {
                        throw new Error("not used");
                    }}
                    onRetryTask={vi.fn()}
                    onRetryRun={vi.fn()}
                    onRetrySubmission={vi.fn()}
                    onEditMessage={vi.fn()}
                    selectedAssetIds={[]}
                    onToggleAsset={vi.fn()}
                />
            </App>
        </NextIntlClientProvider>,
    );
}

describe("CreativeMessages", () => {
    it("renders completed assistant markdown instead of showing syntax markers", () => {
        const message: CreativeMessage = {
            id: "assistant-markdown",
            conversationId: "conversation-one",
            sequence: 2,
            role: "assistant",
            status: "completed",
            content: "以下为一份**通用专业简历报告模板**。\n\n---\n\n# 个人职业简历报告",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const markup = renderCreativeMessages({ messages: [message] });

        expect(markup).toContain("<strong");
        expect(markup).toContain("通用专业简历报告模板</strong>");
        expect(markup).toContain("<hr");
        expect(markup).toContain("<h1");
        expect(markup).not.toContain("**通用专业简历报告模板**");
    });

    it("renders current-turn reference images above the user message", () => {
        const message: CreativeMessage = {
            id: "user-message",
            conversationId: "conversation-one",
            sequence: 1,
            role: "user",
            status: "completed",
            content: "把她换成白发",
            metadata: { assetIds: ["reference-one"] },
            createdAt: 1,
            updatedAt: 1,
        };
        const asset: CreativeAsset = {
            id: "reference-one",
            userId: "user-one",
            conversationId: "conversation-one",
            sourceRunId: "upload",
            ordinal: 0,
            type: "image",
            status: "ready",
            title: "人物参考图",
            serverUrl: "/api/reference-assets/permanent/person.png",
            storageKey: "permanent/person.png",
            mimeType: "image/png",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const markup = renderCreativeMessages({ messages: [message], assets: [asset] });

        expect(markup).toContain(`aria-label="${tZh("referenceStripAria")}"`);
        expect(markup.indexOf('alt="人物参考图"')).toBeLessThan(markup.indexOf("把她换成白发"));
    });

    it("keeps generated media compact without cropping it and uses i18n action labels", () => {
        const message: CreativeMessage = {
            id: "message-one",
            conversationId: "conversation-one",
            sequence: 1,
            role: "assistant",
            status: "completed",
            content: "图片已生成。",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const asset: CreativeAsset = {
            id: "asset-one",
            userId: "user-one",
            conversationId: "conversation-one",
            messageId: message.id,
            ordinal: 0,
            type: "image",
            status: "ready",
            title: "生成图片",
            serverUrl: "/generated/image.png",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const markup = renderCreativeMessages({ messages: [message], assets: [asset] });

        expect(markup).toContain("max-w-[1040px]");
        expect(markup).toContain("flex-wrap");
        expect(markup).toContain("w-[min(100%,240px)]");
        expect(markup).toContain("object-contain");
        expect(markup).toContain("!size-full object-contain");
        expect(markup).toContain("h-36 sm:h-40");
        expect(markup).toContain(`aria-label="${tZh("referenceAsset")}"`);
        expect(markup).toContain(`aria-label="${tZh("downloadImage")}"`);
        expect(markup).toContain(`aria-label="${tZh("copyMessage")}"`);
        expect(markup).toContain("mt-1 flex min-h-8 items-center justify-end");
        expect(markup).not.toContain("absolute bottom-2 right-2");
        expect(markup).not.toContain("drop-shadow(0_1px_2px_rgba(0,0,0,0.85))");
        expect(markup).not.toContain("bg-white/90");
        expect(markup).not.toContain("<figcaption");
        expect(markup).not.toContain(`>${tZh("referenceAsset")}<`);
        expect(markup).not.toContain("border-stone-200 bg-stone-50");
        expect(markup).not.toContain("aspect-square");
    });

    it("offers an in-place retry for an initial submission failure", () => {
        const message: CreativeMessage = {
            id: "temporary-assistant",
            conversationId: "pending",
            sequence: 2,
            role: "assistant",
            status: "failed",
            content: "创作请求失败",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const markup = renderCreativeMessages({ messages: [message] });

        expect(markup).toContain(`aria-label="${tZh("retrySubmissionAria")}"`);
        expect(markup).toContain(tZh("retry"));
    });

    it("offers an explicit retry when Agent planning finished with an uncertain result", () => {
        const message: CreativeMessage = {
            id: "assistant-message",
            conversationId: "conversation-one",
            runId: "run-one",
            sequence: 2,
            role: "assistant",
            status: "failed",
            content: "Agent 规划请求结果待确认",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const run: CreativeAgentRun = {
            id: "run-one",
            conversationId: "conversation-one",
            inputMessageId: "user-message",
            assistantMessageId: message.id,
            status: "failed",
            assetIds: [],
            tasks: [],
        };
        const markup = renderCreativeMessages({
            messages: [message],
            runDetails: { "run-one": run },
        });

        expect(markup).toContain(`aria-label="${tZh("reanalyzeAria")}"`);
        expect(markup).toContain(tZh("confirmRetryHint"));
        expect(markup).toContain(tZh("reanalyze"));
    });

    it("switches creative message chrome to English under en locale", () => {
        const message: CreativeMessage = {
            id: "message-one",
            conversationId: "conversation-one",
            sequence: 1,
            role: "assistant",
            status: "completed",
            content: "Image ready.",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const asset: CreativeAsset = {
            id: "asset-one",
            userId: "user-one",
            conversationId: "conversation-one",
            messageId: message.id,
            ordinal: 0,
            type: "image",
            status: "ready",
            title: "Generated image",
            serverUrl: "/generated/image.png",
            metadata: {},
            createdAt: 1,
            updatedAt: 1,
        };
        const markup = renderCreativeMessages({ messages: [message], assets: [asset] }, "en");

        expect(markup).toContain(`aria-label="${tEn("referenceAsset")}"`);
        expect(markup).toContain(`aria-label="${tEn("downloadImage")}"`);
        expect(markup).toContain(`aria-label="${tEn("copyMessage")}"`);
        expect(markup).not.toContain(`aria-label="${tZh("referenceAsset")}"`);
        expect(markup).not.toContain(`aria-label="${tZh("downloadImage")}"`);
    });
});
