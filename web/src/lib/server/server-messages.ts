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

    // auto-expanded from server.json progressive map
    ["该渠道尚未保存可用的 API Key", "admin.channelNoApiKey"],
    ["接口渠道不存在", "admin.channelNotFound"],
    ["默认接口未配置或已停用", "admin.defaultChannelMissing"],
    ["后台尚未配置可用的默认文本模型", "admin.defaultTextModelMissing"],
    ["请先填写 Base URL 和 API Key", "admin.fillBaseUrlAndKey"],
    ["请填写 Base URL、API Key，并选择要测试的模型", "admin.fillChannelTestFields"],
    ["获取生成运营摘要失败", "admin.generationOpsSummaryFailed"],
    ["GlobalAiOpc 图片预设未配置", "admin.globalAiOpcImagePresetMissing"],
    ["该 GlobalAiOpc 原生文本接口不支持 Responses，已切换 Chat 兼容回退。", "admin.globalAiOpcResponsesFallback"],
    ["未识别到 GlobalAiOpc 接口范围，请检查 Base URL 或重新选择接口范围", "admin.globalAiOpcScopeUnrecognized"],
    ["图片测试失败", "admin.imageTestFailed"],
    ["维护任务认证失败", "admin.maintenanceAuthFailed"],
    ["维护任务令牌未配置", "admin.maintenanceTokenMissing"],
    ["接口请求成功，但返回内容中没有识别到模型列表", "admin.modelListEmpty"],
    ["该模型未在后台渠道中启用", "admin.modelNotEnabled"],
    ["该上游未提供模型列表接口，请在高级设置的“模型列表”手动填写模型名称；不影响已配置的视频生成接口。", "admin.noModelListEndpoint"],
    ["没有可更新的设置", "admin.noSettingsToUpdate"],
    ["读取 API Key 失败", "admin.readApiKeyFailed"],
    ["更新设置失败", "admin.updateSettingsFailed"],
    ["上游文本接口返回了无效 JSON", "admin.upstreamInvalidJson"],
    ["上游接口不允许重定向，请检查后台渠道地址", "admin.upstreamRedirectBlocked"],
    ["视频测试失败：所有兼容路径都不可用", "admin.videoTestAllPathsFailed"],
    ["复盘记录标识无效", "agent.invalidReviewId"],
    ["只有失败任务可以单独重试", "agent.onlyFailedCanRetry"],
    ["创作需求不能为空", "agent.requirementEmpty"],
    ["不支持的 Agent 操作", "agent.unsupportedAction"],
    ["创建公告失败", "auth.announcementCreateFailed"],
    ["删除公告失败", "auth.announcementDeleteFailed"],
    ["更新公告失败", "auth.announcementUpdateFailed"],
    ["删除 CDK 失败", "auth.cdkDeleteFailed"],
    ["生成 CDK 失败", "auth.cdkGenerateFailed"],
    ["更新 CDK 失败", "auth.cdkUpdateFailed"],
    ["修改密码失败", "auth.changePasswordFailed"],
    ["请选择受理或拒绝", "auth.chooseAcceptOrReject"],
    ["验证码用途不正确", "auth.codePurposeInvalid"],
    ["注销申请处理失败", "auth.deletionRequestFailed"],
    ["注销申请提交失败", "auth.deletionSubmitFailed"],
    ["注销申请已提交", "auth.deletionSubmitted"],
    ["注销申请撤回失败", "auth.deletionWithdrawFailed"],
    ["注销申请已撤回", "auth.deletionWithdrawn"],
    ["个人数据导出失败，请稍后重试", "auth.exportFailed"],
    ["登录失败，请稍后重试", "auth.loginFailed"],
    ["注册失败，请稍后重试", "auth.registerFailed"],
    ["重置密码失败", "auth.resetPasswordFailed"],
    ["发送验证码失败，请稍后重试", "auth.sendCodeFailed"],
    ["更新个人资料失败", "auth.updateProfileFailed"],
    ["新增用户失败", "auth.userCreateFailed"],
    ["删除用户失败", "auth.userDeleteFailed"],
    ["更新用户失败", "auth.userUpdateFailed"],
    ["认证备份不能安全导入", "backup.authImportUnsafe"],
    ["备份文件过大，请确认文件是否正确", "backup.fileTooLarge"],
    ["备份文件格式不正确", "backup.formatInvalid"],
    ["备份上传格式不正确", "backup.invalidFormat"],
    ["导入的用户数据库里没有可用管理员账号，为避免锁死后台已取消导入", "backup.noAdminInImport"],
    ["备份文件里没有可导入的数据", "backup.noImportableData"],
    ["请选择要导入的备份文件", "backup.selectFile"],
    ["用户数据库备份格式不正确", "backup.userDbFormatInvalid"],
    ["取消订单失败", "billing.cancelOrderFailed"],
    ["签到功能已取消，每日免费积分会按套餐自动发放且仅当日有效", "billing.checkInDeprecated"],
    ["关闭过期订单失败", "billing.closeExpiredOrdersFailed"],
    ["关闭订单失败", "billing.closeOrderFailed"],
    ["确认支付失败", "billing.confirmPaymentFailed"],
    ["创建订单失败", "billing.createOrderFailed"],
    ["创建支付参数失败", "billing.createPaymentParamsFailed"],
    ["删除套餐商品失败", "billing.deleteProductFailed"],
    ["获取订单失败", "billing.getOrderFailed"],
    ["获取套餐商品失败", "billing.getPlanProductsFailed"],
    ["支付渠道无效", "billing.invalidPaymentChannel"],
    ["退款标记失败", "billing.markRefundFailed"],
    ["支付回调处理失败", "billing.paymentCallbackFailed"],
    ["对账批次不存在", "billing.reconBatchNotFound"],
    ["支付账单对账失败", "billing.reconFailed"],
    ["获取支付对账记录失败", "billing.reconListFailed"],
    ["兑换失败", "billing.redeemFailed"],
    ["保存支付配置失败", "billing.savePaymentConfigFailed"],
    ["保存套餐商品失败", "billing.saveProductFailed"],
    ["更新套餐商品失败", "billing.updateProductFailed"],
    ["获取财务钱包摘要失败", "billing.walletSummaryFailed"],
    ["已取消", "common.cancelled"],
    ["创建失败", "common.createFailed"],
    ["删除失败", "common.deleteFailed"],
    ["权限不足", "common.forbidden"],
    ["请先完成数据库初始化并配置加密密钥", "common.installRequired"],
    ["请求内容不是有效 JSON", "common.invalidJsonBody"],
    ["无效请求", "common.invalidRequest"],
    ["加载失败", "common.loadFailed"],
    ["未配置", "common.notConfigured"],
    ["未找到", "common.notFound"],
    ["操作失败", "common.operationFailed"],
    ["参数错误", "common.paramError"],
    ["请求过于频繁，请稍后重试", "common.rateLimited"],
    ["{feature}过于频繁，请稍后再试", "common.rateLimitedFeatureAgain"],
    ["{feature}过于频繁，请稍后重试", "common.rateLimitedFeatureRetry"],
    ["{feature}过于频繁，请 {seconds} 秒后再试", "common.rateLimitedWithSeconds"],
    ["请求失败", "common.requestFailed"],
    ["资源不存在", "common.resourceNotFound"],
    ["保存失败", "common.saveFailed"],
    ["服务暂不可用", "common.serviceUnavailable"],
    ["更新失败", "common.updateFailed"],
    ["创作会话不能为空", "creative.sessionRequired"],
    ["请先完成全部镜头视频", "drama.allShotVideosRequired"],
    ["请先完成内容审核", "drama.contentReviewRequired"],
    ["短剧剧集不存在", "drama.episodeNotFound"],
    ["当前服务器未安装 FFmpeg", "drama.ffmpegMissing"],
    ["剪映草稿导出失败", "drama.jianyingExportFailed"],
    ["请先填写剧本", "drama.scriptRequired"],
    ["单次解析剧本不能超过 30000 字", "drama.scriptTooLong"],
    ["请先生成至少一张可读取的分镜图", "drama.storyboardRequired"],
    ["部分镜头选择了 AI 配音，但配音尚未完成", "drama.voiceoverIncomplete"],
    ["音频生成请求", "features.audioGen"],
    ["图片生成请求", "features.imageGen"],
    ["文本生成请求", "features.textGen"],
    ["视频生成请求", "features.videoGen"],
    ["服务尚未就绪", "health.notReady"],
    ["数据库初始化失败", "install.dbInitFailed"],
    ["单个素材不能超过 20MB", "media.assetTooLarge20mb"],
    ["外部存储文件加载失败", "media.externalFileLoadFailed"],
    ["外部存储对象删除失败", "media.externalObjectDeleteFailed"],
    ["外部存储文件读取失败", "media.externalReadFailed"],
    ["连接失败，请检查 Endpoint、Region、Bucket 和访问密钥", "media.externalStorageConnectFailed"],
    ["外部存储配置保存失败", "media.externalStorageSaveFailed"],
    ["媒体文件为空", "media.fileEmpty"],
    ["媒体文件不存在", "media.fileNotFound"],
    ["媒体文件超过大小限制", "media.fileTooLarge"],
    ["本地媒体迁移失败", "media.localMigrateFailed"],
    ["缺少参考素材", "media.missingReference"],
    ["媒体文件不存在或已过期", "media.notFoundOrExpired"],
    ["没有需要删除的媒体文件", "media.nothingToDelete"],
    ["参考图已失效，请重新上传", "media.refExpired"],
    ["参考图读取失败", "media.refImageReadFailed"],
    ["参考图读取失败，请重新上传参考图", "media.refImageReread"],
    ["参考图过大，请压缩后重试", "media.refImageTooLarge"],
    ["参考图需要公网图片 URL；本地开发 localhost 不能直接提交给上游，请部署后配置 NEXT_PUBLIC_SITE_URL", "media.refNeedsPublicUrl"],
    ["参考图不是有效 base64 图片", "media.refNotBase64"],
    ["参考图不是有效图片", "media.refNotImage"],
    ["站内参考素材签名不可用，请配置 VOZEB_PRO_ENCRYPTION_KEY", "media.refSignUnavailable"],
    ["参考图临时保存失败", "media.refTempSaveFailed"],
    ["参考图地址无效，请重新上传参考图", "media.refUrlInvalid"],
    ["请选择要删除的对象", "media.selectObjectsToDelete"],
    ["请选择要删除的媒体文件", "media.selectToDelete"],
    ["请选择上传文件", "media.selectUploadFile"],
    ["过期临时文件已清理", "media.tempCleaned"],
    ["上传内容格式不正确", "media.uploadFormatInvalid"],
    ["新增提示词失败", "prompts.createFailed"],
    ["删除提示词失败", "prompts.deleteFailed"],
    ["更新提示词失败", "prompts.updateFailed"],
    ["Agent 任务不存在", "tasks.agentNotFound"],
    ["Agent 请求内容过长", "tasks.agentPayloadTooLong"],
    ["Agent 文本规划失败，请检查默认文本模型和渠道", "tasks.agentPlanFailed"],
    ["Agent 请求标识无效", "tasks.agentRequestIdInvalid"],
    ["Agent 状态已变化，请刷新后重试", "tasks.agentStatusChanged"],
    ["音频生成失败", "tasks.audioGenFailed"],
    ["音频接口没有返回音频或任务 ID", "tasks.audioNoId"],
    ["音频任务参数不完整或渠道不支持", "tasks.audioParamsOrChannel"],
    ["音频结果为空或超过 30MB 限制", "tasks.audioResultEmptyOrTooLarge"],
    ["音频结果保存失败", "tasks.audioSaveFailed"],
    ["音频生成超时", "tasks.audioTimeout"],
    ["任务已取消", "tasks.cancelled"],
    ["合成任务不存在", "tasks.composeNotFound"],
    ["Gemini 接口没有返回图片", "tasks.geminiNoImage"],
    ["Gemini 暂不支持蒙版编辑", "tasks.geminiNoMask"],
    ["Gemini 没有返回有效文本内容", "tasks.geminiNoText"],
    ["生成失败", "tasks.generationFailed"],
    ["图片宽高比不能超过 3:1，请调整尺寸", "tasks.imageAspectTooWide"],
    ["当前用户生图任务已达到并发上限，请稍后再试", "tasks.imageConcurrencyLimitRetry"],
    ["图片任务完成但没有返回图片", "tasks.imageDoneNoImage"],
    ["图片生成失败", "tasks.imageGenFailed"],
    ["图片尺寸最长边不能超过 3840px，请调整尺寸", "tasks.imageMaxSide3840"],
    ["图片任务参数不完整或渠道不支持", "tasks.imageParamsOrChannel"],
    ["图片总像素需在 655360 到 8294400 之间，请调整尺寸", "tasks.imagePixelRange"],
    ["图片任务查询失败", "tasks.imageQueryFailed"],
    ["图片比例必须是正数，例如 9:16", "tasks.imageRatioPositive"],
    ["图片尺寸的宽高必须是 16 的倍数，请调整尺寸", "tasks.imageSizeMultiple16"],
    ["图片尺寸必须是正整数，例如 1024x1024", "tasks.imageSizePositiveInt"],
    ["图片尺寸格式不支持，请使用 auto、9:16 或 1024x1024", "tasks.imageSizeUnsupported"],
    ["没有可用的图片渠道", "tasks.noImageChannel"],
    ["接口没有返回图片", "tasks.noImageReturned"],
    ["任务不存在或已过期", "tasks.notFoundOrExpired"],
    ["任务失败", "tasks.taskFailed"],
    ["文本模型没有返回有效内容", "tasks.textEmpty"],
    ["文本生成失败", "tasks.textGenFailed"],
    ["文本任务参数不完整或渠道不支持", "tasks.textParamsOrChannel"],
    ["视频任务创建失败", "tasks.videoCreateFailed"],
    ["视频任务已完成但没有返回视频地址", "tasks.videoDoneNoUrl"],
    ["视频生成失败", "tasks.videoGenFailed"],
    ["视频接口返回了无效 JSON", "tasks.videoInvalidJson"],
    ["视频任务不存在", "tasks.videoNotFound"],
    ["视频任务参数不完整或渠道不支持", "tasks.videoParamsOrChannel"],
    ["视频任务查询失败", "tasks.videoQueryFailed"],
    ["视频生成超时", "tasks.videoTimeout"],

    // auto-expanded from server.json progressive map
    ["拉取模型失败，请检查接口地址和网络", "admin.pullModelsFailed"],
    ["拉取模型超时，请稍后重试", "admin.pullModelsTimeout"],
    ["上游接口请求超时", "admin.upstreamTimeout"],
    ["模型没有生成有效内容结构", "drama.contentStructureInvalid"],
    ["模型没有为全部镜头生成视觉结构", "drama.visualStructureIncomplete"],
    ["Agent 请求", "features.agent"],
    ["成片合成请求", "features.dramaRender"],
    ["导出请求", "features.export"],
    ["生图请求", "features.imageGenShort"],
    ["登录请求", "features.login"],
    ["兑换请求", "features.redeem"],
    ["注册请求", "features.register"],
    ["复盘请求", "features.review"],
    ["视频任务请求", "features.videoTask"],
    ["视觉复盘请求", "features.visualReview"],
    ["没有返回内容", "tasks.noContent"],

    // auto-expanded batch3 progressive map
    ["AI 配音尚未完成", "drama.voiceoverIncompleteAlt"],
    ["Agent Run 已暂停、取消或已由新执行器接管", "agent.runTakenOverOrStopped"],
    ["Agent Run 已由新执行器接管", "agent.runTakenOver"],
    ["Agent 执行失败", "agent.executionFailed"],
    ["模型返回的创作计划无效", "agent.invalidCreationPlan"],
    ["模型返回的工作台计划无效", "agent.invalidWorkbenchPlan"],
    ["模型返回的对话结果无效", "agent.invalidChatResult"],
    ["模型返回的复盘结构无效", "agent.invalidReviewStructure"],
    ["模型返回的决策摘要无效", "agent.invalidDecisionSummary"],
    ["模型返回的任务参数无效", "agent.invalidTaskParams"],
    ["模型返回的任务依赖无效", "agent.invalidTaskDeps"],
    ["模型返回的项目交接参数无效", "agent.invalidHandoffParams"],
    ["模型没有返回所需的结构化结果", "agent.missingStructuredResult"],
    ["模型没有返回结构化剧本结果", "drama.missingStructuredScript"],
    ["项目交接引用了不存在的资产", "agent.handoffMissingAsset"],
    ["部分所选模型当前不可用，请重新选择", "agent.someModelsUnavailable"],
    ["当前模型不支持直接生成媒体", "agent.modelNoDirectMedia"],
    ["Bucket 名称不能包含路径", "media.bucketNoPath"],
    ["Endpoint 必须是有效的 HTTP 或 HTTPS 地址", "media.endpointInvalid"],
    ["请先启用外部存储", "media.enableExternalFirst"],
    ["启用外部存储前请填写 Bucket、Access Key 和 Secret Key", "media.externalRequiredFields"],
    ["外部存储未启用", "media.externalDisabled"],
    ["外部存储配置不完整", "media.externalConfigIncomplete"],
    ["外部存储对象没有可读取内容", "media.externalObjectEmpty"],
    ["媒体所属的外部存储配置不可用", "media.externalConfigUnavailable"],
    ["媒体写入缺少文件内容", "media.writeMissingContent"],
    ["媒体地址为空", "media.urlEmpty"],
    ["媒体地址不安全", "media.urlUnsafe"],
    ["媒体重定向地址无效", "media.redirectInvalid"],
    ["媒体重定向次数过多", "media.redirectTooMany"],
    ["媒体文件格式不正确", "media.fileFormatInvalid"],
    ["媒体文件缺少用户归属", "media.missingUserOwnership"],
    ["对象路径前缀不合法", "media.objectPrefixInvalid"],
    ["参考素材格式不正确", "media.refFormatInvalid"],
    ["生成媒体保存到服务器失败", "media.saveGeneratedFailed"],
    ["当前渠道无法读取站内参考素材，请联系管理员检查站点部署地址", "media.channelCannotReadRef"],
    ["图片任务包含无效产物", "tasks.imageInvalidArtifact"],
    ["VOZEB_PRO_ENCRYPTION_KEY 未配置或格式无效，不能保存敏感配置", "security.encryptionKeyInvalidSave"],
    ["VOZEB_PRO_ENCRYPTION_KEY 未配置或格式无效，不能解密敏感配置", "security.encryptionKeyInvalidDecrypt"],
    ["敏感配置密文格式无效", "security.ciphertextInvalid"],
    ["敏感配置解密失败，请检查 VOZEB_PRO_ENCRYPTION_KEY 是否与加密时一致", "security.decryptFailedKeyMismatch"],
    ["当前服务器认证数据不可用，不能安全导入用户备份", "backup.authDataUnavailable"],
    ["文本任务没有返回有效内容", "tasks.textNoValidContent"],
    ["生成任务写入冲突，请重试", "tasks.writeConflict"],
    ["生成任务失败", "tasks.generationFailed"],
    ["生成任务完成但没有返回有效产物", "tasks.doneNoArtifact"],
    ["生成任务执行超时", "tasks.executionTimeout"],
    ["生成任务未返回任务 ID", "tasks.missingTaskId"],
    ["视频时长无效", "tasks.videoDurationInvalid"],
    ["服务器无法读取视频实际时长，请检查 FFmpeg/FFprobe 配置", "tasks.ffprobeDurationFailed"],
    ["恢复今日套餐积分失败", "points.restoreDailyFailed"],
    ["更新今日套餐积分失败", "points.updateDailyFailed"],
    ["高级请求模板必须是 JSON 对象", "admin.advancedTemplateMustBeObject"],
    ["高级请求模板必须是有效 JSON", "admin.advancedTemplateMustBeJson"],
    ["当前存储模式不需要初始化 PostgreSQL", "install.initNotNeeded"],
    ["请先配置 DATABASE_URL", "install.initNeedDatabaseUrl"],
    ["请先配置有效的 VOZEB_PRO_ENCRYPTION_KEY", "install.initNeedEncryptionKey"],
    ["数据库初始化失败，请查看服务器日志并检查数据库账号权限", "install.initFailed"],
    ["渠道请求失败", "health.channelRequestFailed"],
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
