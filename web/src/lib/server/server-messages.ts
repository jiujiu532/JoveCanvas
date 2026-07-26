import type { AppLocale } from "@/i18n/locale";
import zhServer from "../../../messages/zh/server.json";
import enServer from "../../../messages/en/server.json";

// server 命名空间下所有面向用户的服务端文案字典（按语言）
type ServerMessages = typeof zhServer;
const DICTS: Record<AppLocale, ServerMessages> = { zh: zhServer, en: enServer };

type MessageParams = Record<string, string | number>;

/**
 * 从字典中按 "a.b.c" 形式的 key 读取嵌套字符串值，未命中返回 undefined。
 */
function readNested(dict: unknown, key: string): string | undefined {
    let current: unknown = dict;
    for (const part of key.split(".")) {
        if (typeof current !== "object" || current === null) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: MessageParams): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (matched, name: string) => (name in params ? String(params[name]) : matched));
}

/**
 * 解析当前请求语言。Route Handler / 服务层运行时通过 next-intl/server 读取 cookie 语言。
 * 被 vitest 直接 import 调用的 Route Handler 缺少 react-server condition，next-intl/server
 * 的函数会直接抛错，此时回落为默认中文，保证既有断言中文文案的测试不受影响。
 */
async function resolveServerLocale(): Promise<AppLocale> {
    try {
        const { getLocale } = await import("next-intl/server");
        const locale = await getLocale();
        return locale === "en" ? "en" : "zh";
    } catch {
        return "zh";
    }
}

/**
 * 获取按当前请求语言解析的 server 命名空间翻译函数。
 * 用法：`const t = await getServerMessages(); t("common.pleaseLogin")`
 */
export async function getServerMessages() {
    const locale = await resolveServerLocale();
    const dict = DICTS[locale];
    return function t(key: string, params?: MessageParams): string {
        const template = readNested(dict, key) ?? readNested(DICTS.zh, key);
        if (template === undefined) return key;
        return interpolate(template, params);
    };
}

/**
 * 单次查词的便捷封装，用于只需要一条文案、不想显式持有 t() 的调用点。
 */
export async function serverMessage(key: string, params?: MessageParams): Promise<string> {
    const t = await getServerMessages();
    return t(key, params);
}

/**
 * 已知的服务端错误文案 -> server.json key 映射表。
 *
 * 渐进式国际化策略：现有代码里 BillingInputError / AuthInputError / QuotaExceededError
 * 抛出的中文 message 保持不变（不要求一次改完所有抛错点），Route Handler 在响应层通过
 * localizeErrorMessage() 转译：
 *   1. 错误对象若显式带 messageKey（新增可选字段），直接按 key 查字典（支持 messageParams 插值）
 *   2. 否则用 message 原文反查这张表，命中则按当前语言渲染
 *   3. 都未命中则原样返回 message（多为尚未纳入表内的长尾错误，默认中文，不影响现有测试）
 */
// 用数组而非对象字面量存放该映射：中文 key 里带空格/CDK/JSON 等 ASCII 片段时无法作为合法的裸标识符，
// 数组项统一是字符串字面量可以规避这个问题，同时避免逐个手工加引号出错。
const KNOWN_ERROR_MESSAGE_ENTRIES: Array<[string, string]> = [
    ["请先登录", "common.pleaseLogin"],
    ["需要管理员权限", "common.adminRequired"],
    ["用户不存在", "common.userNotFound"],
    ["用户不可用", "common.userInactive"],
    ["积分不足", "points.quotaExceeded"],

    // auth（lib/auth/store-actions.ts 的 AuthInputError）
    ["CDK 不存在", "auth.cdkNotFound"],
    ["请选择要删除的CDK", "auth.cdkSelectToDelete"],
    ["请选择要删除的 CDK", "auth.cdkSelectToDelete"],
    ["请输入CDK密钥", "auth.cdkKeyRequired"],
    ["请输入 CDK 密钥", "auth.cdkKeyRequired"],
    ["CDK 无效或已停用", "auth.cdkInvalid"],
    ["CDK 已过期", "auth.cdkExpired"],
    ["CDK 已兑换完", "auth.cdkExhausted"],
    ["该CDK已被当前账号兑换", "auth.cdkAlreadyRedeemedByAccount"],
    ["该 CDK 已被当前账号兑换", "auth.cdkAlreadyRedeemedByAccount"],
    ["请填写公告标题和内容", "auth.announcementRequired"],
    ["公告不存在", "auth.announcementNotFound"],
    ["退款缺少原消费流水", "auth.refundMissingSourceRecord"],
    ["注册已关闭", "auth.registrationClosed"],
    ["请填写邮箱地址", "auth.emailRequired"],
    ["用户名已存在", "auth.usernameTaken"],
    ["邮箱已被注册", "auth.emailTaken"],
    ["用户名或密码不正确", "auth.invalidCredentials"],
    ["账号已被禁用", "auth.accountDisabled"],
    ["当前未开启邮箱注册", "auth.emailRegistrationDisabled"],
    ["没有找到绑定该邮箱的账号", "auth.emailAccountNotFound"],
    ["验证码发送过于频繁，请 60 秒后再试", "auth.emailCodeRateLimited"],
    ["当前密码不正确", "auth.currentPasswordIncorrect"],
    ["没有找到可用账号", "auth.noAvailableAccount"],
    ["不能禁用当前登录的管理员账号", "auth.cannotDisableSelfAdmin"],
    ["至少需要保留一个管理员", "auth.mustKeepOneAdmin"],
    ["至少需要保留一个可用管理员", "auth.mustKeepOneActiveAdmin"],
    ["不能删除当前登录的管理员账号", "auth.cannotDeleteSelfAdmin"],

    // billing（lib/server 下 BillingInputError 相关）
    ["PayPly 退款请求体模板必须是有效 JSON 对象", "billing.paymentPlyRefundTemplateInvalidJson"],
    ["PayPly 未返回有效支付参数", "billing.paymentPlyMissingPayParams"],
    ["Stripe 回调密钥未配置", "billing.stripeWebhookSecretMissing"],
    ["Stripe 回调签名缺失", "billing.stripeSignatureMissing"],
    ["Stripe 回调签名无效", "billing.stripeSignatureInvalid"],
    ["Stripe 回调时间戳无效", "billing.stripeTimestampInvalid"],
    ["Stripe 未返回有效支付链接", "billing.stripeMissingPaymentUrl"],
    ["当前订单状态不能发起支付", "billing.orderStatusCannotPay"],
    ["当前订单状态不能取消", "billing.orderStatusCannotCancel"],
    ["当前订单状态不能确认支付", "billing.orderStatusCannotConfirm"],
    ["订单不存在", "billing.orderNotFound"],
    ["订单没有绑定用户", "billing.orderMissingUser"],
    ["订单缺少支付流水，不能自动退款", "billing.orderMissingPaymentRecordForRefund"],
    ["订单已过期", "billing.orderExpired"],
    ["订单用户不存在", "billing.orderUserNotFound"],
    ["该商品已有订单记录，不能永久删除，请改为下架", "billing.productHasOrdersCannotDelete"],
    ["该支付渠道未接入自动退款，不能直接标记本地退款", "billing.channelNoAutoRefundSupport"],
    ["该支付渠道未配置自动退款接口，请先配置 PayPly 退款接口后再退款", "billing.channelRefundNotConfigured"],
    ["该支付渠道未启用或配置不完整", "billing.channelDisabledOrIncomplete"],
    ["积分充值订单不能创建套餐权益", "billing.pointsOrderCannotCreatePlan"],
    ["积分充值商品的积分必须大于零", "billing.pointsProductAmountMustBePositive"],
    ["请填写商品名称", "billing.productNameRequired"],
    ["请选择商品", "billing.productSelectRequired"],
    ["请粘贴支付商账单 CSV 内容", "billing.reconciliationCsvRequired"],
    ["缺少 Stripe PaymentIntent 或 Charge，不能自动退款", "billing.stripeMissingPaymentIntentForRefund"],
    ["商品不存在或已下架", "billing.productNotFoundOrDelisted"],
    ["商业订单需要启用PostgreSQL", "billing.orderRequiresPostgres"],
    ["商业订单需要启用 PostgreSQL", "billing.orderRequiresPostgres"],
    ["套餐不存在或已停用", "billing.planNotFoundOrDisabled"],
    ["套餐订单缺少套餐权益", "billing.planOrderMissingEntitlement"],
    ["套餐商品不存在", "billing.planProductNotFound"],
    ["退款正在处理中，请稍后再试", "billing.refundInProgress"],
    ["退款状态已变化，请刷新后重试", "billing.refundStatusChanged"],
    ["微信支付 API v3 key 必须是 32 字节", "billing.wechatApiV3KeyLengthInvalid"],
    ["微信支付回调加密算法不支持", "billing.wechatCallbackAlgorithmUnsupported"],
    ["微信支付回调解密失败", "billing.wechatCallbackDecryptFailed"],
    ["微信支付回调密文无效", "billing.wechatCallbackCiphertextInvalid"],
    ["微信支付回调资源缺失", "billing.wechatCallbackResourceMissing"],
    ["微信支付退款只支持CNY订单", "billing.wechatRefundCnyOnly"],
    ["微信支付退款只支持 CNY 订单", "billing.wechatRefundCnyOnly"],
    ["微信支付未返回有效二维码链接", "billing.wechatMissingQrCodeUrl"],
    ["暂不支持该支付渠道", "billing.channelNotSupported"],
    ["支付币种与订单币种不一致", "billing.currencyMismatch"],
    ["支付对账需要启用PostgreSQL", "billing.reconciliationRequiresPostgres"],
    ["支付对账需要启用 PostgreSQL", "billing.reconciliationRequiresPostgres"],
    ["支付回调密钥未配置", "billing.webhookSecretMissing"],
    ["支付回调内容不是有效JSON", "billing.webhookBodyInvalidJson"],
    ["支付回调内容不是有效 JSON", "billing.webhookBodyInvalidJson"],
    ["支付回调签名无效", "billing.webhookSignatureInvalid"],
    ["支付回调需要启用PostgreSQL", "billing.webhookRequiresPostgres"],
    ["支付回调需要启用 PostgreSQL", "billing.webhookRequiresPostgres"],
    ["支付金额与订单金额不一致", "billing.amountMismatch"],
    ["支付商账单没有可对账的数据行", "billing.reconciliationCsvNoDataRows"],
    ["支付商账单至少需要表头和一行数据", "billing.reconciliationCsvMissingRows"],
    ["支付下单需要启用PostgreSQL", "billing.checkoutRequiresPostgres"],
    ["支付下单需要启用 PostgreSQL", "billing.checkoutRequiresPostgres"],
    ["只有待支付订单可以关闭", "billing.onlyPendingOrderCanClose"],
    ["只有已支付订单可以退款", "billing.onlyPaidOrderCanRefund"],
];

const KNOWN_ERROR_MESSAGE_KEYS: Record<string, string> = Object.fromEntries(KNOWN_ERROR_MESSAGE_ENTRIES);

export interface LocalizableError {
    message: string;
    messageKey?: string;
    messageParams?: MessageParams;
}

/**
 * 转译一个可能带 messageKey 的错误为当前语言文案。
 * - 有 messageKey：按 key（+可选 messageParams）查字典
 * - 无 messageKey：用 message 原文反查 KNOWN_ERROR_MESSAGE_KEYS
 * - 都未命中：原样返回 message（尚未纳入表内的长尾错误，默认中文行为不变）
 */
export async function localizeErrorMessage(error: LocalizableError): Promise<string> {
    const t = await getServerMessages();
    if (error.messageKey) return t(error.messageKey, error.messageParams);
    const key = KNOWN_ERROR_MESSAGE_KEYS[error.message];
    if (key) return t(key);
    return error.message;
}
