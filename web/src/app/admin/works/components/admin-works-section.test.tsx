import { App } from "antd";
import { NextIntlClientProvider } from "next-intl";
import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import adminMessages from "../../../../../messages/zh/admin.json";
import { AdminWorksSection } from "./admin-works-section";

const messages = { admin: adminMessages };
const t = createTranslator({ locale: "zh", messages, namespace: "admin.content.works" });

describe("admin works table layout", () => {
    it("uses compact filters, a desktop table and no removed comment governance entry", () => {
        const markup = renderToStaticMarkup(
            <NextIntlClientProvider locale="zh" messages={messages}>
                <App>
                    <AdminWorksSection />
                </App>
            </NextIntlClientProvider>,
        );

        expect(markup).toContain('data-testid="admin-work-filters"');
        expect(markup).toContain("grid-cols-2");
        expect(markup).toContain("md:grid-cols-[minmax(180px,1fr)");
        expect(markup.match(new RegExp(`>${t("statusAll")}<`, "g"))).toHaveLength(2);
        expect(markup).toContain("admin-work-table");
        expect(markup).toContain(t("tabReviews"));
        expect(markup).toContain(t("tabGovernance"));
        expect(markup).not.toContain("评论治理");
    });
});
