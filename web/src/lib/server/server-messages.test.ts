import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerMessages, localizeErrorMessage, serverMessage } from "./server-messages";
import zhServer from "../../../messages/zh/server.json";
import enServer from "../../../messages/en/server.json";

function flatten(obj: unknown, prefix = ""): Record<string, string> {
    const out: Record<string, string> = {};
    if (typeof obj === "object" && obj !== null) {
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const path = prefix ? `${prefix}.${key}` : key;
            Object.assign(out, flatten(value, path));
        }
    } else if (typeof obj === "string") {
        out[prefix] = obj;
    }
    return out;
}

afterEach(() => {
    vi.doUnmock("next-intl/server");
    vi.resetModules();
    vi.restoreAllMocks();
});

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

    it("localizes high-traffic route messages via messageKey", async () => {
        await expect(serverMessage("common.pleaseLogin")).resolves.toBe("请先登录");
        await expect(serverMessage("tasks.notFoundOrExpired")).resolves.toBe("任务不存在或已过期");
        await expect(serverMessage("tasks.cannotCancel")).resolves.toBe("当前任务无法取消");
        await expect(serverMessage("agent.requirementEmpty")).resolves.toBe("创作需求不能为空");
        await expect(serverMessage("billing.orderNotFound")).resolves.toBe("订单不存在");
        await expect(serverMessage("prompts.createFailed")).resolves.toBe("新增提示词失败");
    });

    it("localizes creative/agent runtime server messages", async () => {
        await expect(serverMessage("agent.requirementEmpty")).resolves.toBe("创作需求不能为空");
        await expect(serverMessage("agent.executionFailed")).resolves.toBe("Agent 执行失败");
        await expect(serverMessage("agent.invalidCreationPlan")).resolves.toBe("模型返回的创作计划无效");
        await expect(serverMessage("agent.onlyFailedCanRetry")).resolves.toBe("只有失败任务可以单独重试");
        await expect(serverMessage("agent.onlyPlanFailedCanRetryAll")).resolves.toBe("只有规划阶段失败的任务可以整体重试");
        await expect(serverMessage("agent.concurrencyLimit", { limit: 3 })).resolves.toBe("当前最多同时运行 3 个 Agent 任务");
        await expect(serverMessage("agent.handoffMissingAsset")).resolves.toBe("项目交接引用了不存在的资产");
    });

    it("localizes rate-limit feature templates", async () => {
        const feature = await serverMessage("features.login");
        await expect(serverMessage("common.rateLimitedFeatureRetry", { feature })).resolves.toBe("登录请求过于频繁，请稍后重试");
        await expect(
            serverMessage("common.rateLimitedWithSeconds", { feature: await serverMessage("features.apiTest"), seconds: 12 }),
        ).resolves.toBe("接口测试过于频繁，请 12 秒后再试");
    });

    it("keeps zh/en leaf keys in parity", () => {
        const zh = flatten(zhServer);
        const en = flatten(enServer);
        expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
        expect(Object.keys(zh).length).toBeGreaterThan(400);
    });

    it("maps known Chinese auth/billing errors for localizeErrorMessage", async () => {
        await expect(localizeErrorMessage({ message: "请先登录" })).resolves.toBe("请先登录");
        await expect(localizeErrorMessage({ message: "用户名或密码不正确" })).resolves.toBe("用户名或密码不正确");
        await expect(localizeErrorMessage({ message: "订单不存在" })).resolves.toBe("订单不存在");
        await expect(localizeErrorMessage({ message: "当前任务无法取消" })).resolves.toBe("当前任务无法取消");
    });

    it("maps works/commerce/avatar Chinese messages for localizeErrorMessage", async () => {
        await expect(localizeErrorMessage({ message: "作品不存在" })).resolves.toBe("作品不存在");
        await expect(localizeErrorMessage({ message: "作品状态已变化，请刷新后重试" })).resolves.toBe("作品状态已变化，请刷新后重试");
        await expect(localizeErrorMessage({ message: "优惠券已领完" })).resolves.toBe("优惠券已领完");
        await expect(localizeErrorMessage({ message: "邀请码无效或已停用" })).resolves.toBe("邀请码无效或已停用");
        await expect(localizeErrorMessage({ message: "仅支持 PNG、JPG 或 WebP 头像" })).resolves.toBe("仅支持 PNG、JPG 或 WebP 头像");
        await expect(localizeErrorMessage({ message: "创建作品失败" })).resolves.toBe("创建作品失败");
    });

    it("resolves English creative/agent messages when getLocale returns en", async () => {
        vi.resetModules();
        vi.doMock("next-intl/server", () => ({
            getLocale: async () => "en",
        }));
        const { serverMessage: enServerMessage, localizeErrorMessage: enLocalize } = await import("./server-messages");

        await expect(enServerMessage("agent.requirementEmpty")).resolves.toBe("Creative requirement cannot be empty");
        await expect(enServerMessage("agent.executionFailed")).resolves.toBe("Agent execution failed");
        await expect(enServerMessage("agent.concurrencyLimit", { limit: 2 })).resolves.toBe(
            "At most 2 Agent tasks can run at the same time",
        );
        await expect(enLocalize({ message: "创作需求不能为空" })).resolves.toBe("Creative requirement cannot be empty");
        await expect(enLocalize({ message: "fallback", messageKey: "agent.invalidCreationPlan" })).resolves.toBe(
            "The model returned an invalid creation plan",
        );
    });

    it("resolves English works/commerce messages when getLocale returns en", async () => {
        vi.resetModules();
        vi.doMock("next-intl/server", () => ({
            getLocale: async () => "en",
        }));
        const { serverMessage: enServerMessage, localizeErrorMessage: enLocalize } = await import("./server-messages");

        await expect(enServerMessage("works.notFound")).resolves.toBe("Work not found");
        await expect(enLocalize({ message: "作品不存在" })).resolves.toBe("Work not found");
        await expect(enLocalize({ message: "优惠券已领完" })).resolves.toBe("Coupon is sold out");
        await expect(enLocalize({ message: "邀请码无效或已停用" })).resolves.toBe("Referral code is invalid or disabled");
        await expect(enLocalize({ message: "仅支持 PNG、JPG 或 WebP 头像" })).resolves.toBe(
            "Only PNG, JPG, or WebP avatars are supported",
        );
        await expect(enLocalize({ message: "创建作品失败" })).resolves.toBe("Failed to create work");
    });
});
