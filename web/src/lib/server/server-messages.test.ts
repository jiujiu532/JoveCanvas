import { describe, expect, it } from "vitest";
import { getServerMessages, localizeErrorMessage, serverMessage } from "./server-messages";

describe("server-messages", () => {
    it("falls back to zh in test environment (next-intl/server unavailable)", async () => {
        const t = await getServerMessages();
        expect(t("common.pleaseLogin")).toBe("请先登录");
    });

    it("interpolates params", async () => {
        const t = await getServerMessages();
        expect(t("common.rateLimitedFeatureRetry", { feature: "生图请求" })).toBe("生图请求过于频繁，请稍后重试");
    });

    it("returns key untouched when missing", async () => {
        const t = await getServerMessages();
        expect(t("common.doesNotExist")).toBe("common.doesNotExist");
    });

    it("serverMessage is a convenience wrapper", async () => {
        expect(await serverMessage("common.adminRequired")).toBe("需要管理员权限");
    });

    it("localizeErrorMessage resolves by messageKey first", async () => {
        const msg = await localizeErrorMessage({ message: "fallback", messageKey: "billing.orderNotFound" });
        expect(msg).toBe("订单不存在");
    });

    it("localizeErrorMessage falls back to known chinese message lookup", async () => {
        const msg = await localizeErrorMessage({ message: "积分不足" });
        expect(msg).toBe("积分不足");
    });

    it("localizeErrorMessage returns original message when unmapped", async () => {
        const msg = await localizeErrorMessage({ message: "一个尚未纳入字典的自定义错误" });
        expect(msg).toBe("一个尚未纳入字典的自定义错误");
    });
});
