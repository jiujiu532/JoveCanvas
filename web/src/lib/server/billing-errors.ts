export class BillingInputError extends Error {
    constructor(
        message: string,
        readonly status = 400,
        // i18n 渐进迁移：显式传入时 Route Handler 响应层按当前语言字典渲染，
        // 未传时按 message 原文反查已知文案表（server-messages.ts），都未命中则原样返回中文 message
        readonly messageKey?: string,
        readonly messageParams?: Record<string, string | number>,
    ) {
        super(message);
    }
}

export function isBillingInputError(error: unknown): error is BillingInputError {
    return error instanceof BillingInputError;
}
