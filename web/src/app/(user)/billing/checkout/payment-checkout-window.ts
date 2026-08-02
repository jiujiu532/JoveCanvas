import type { PaymentCheckout } from "@/services/api/billing";

export type PaymentCheckoutOpenResult = { status: "opened" | "blocked" | "invalid" | "manual"; fallbackValue?: string };
export type PaymentCheckoutWindowLabels = { title?: string; body?: string };

type CheckoutWindow = Pick<Window, "close" | "document" | "location"> & { opener: Window["opener"] };
type WindowOpen = (url?: string | URL, target?: string, features?: string) => Window | null;

const defaultOpenWindow: WindowOpen = (url, target, features) => window.open(url, target, features);

export function openPaymentCheckoutWindow(checkout: PaymentCheckout, openWindowOrLabels: WindowOpen | PaymentCheckoutWindowLabels = defaultOpenWindow, maybeLabels: PaymentCheckoutWindowLabels = {}): PaymentCheckoutOpenResult {
    const openWindow = typeof openWindowOrLabels === "function" ? openWindowOrLabels : defaultOpenWindow;
    const labels = typeof openWindowOrLabels === "function" ? maybeLabels : openWindowOrLabels;
    const fallbackValue = checkout.qrContent || checkout.url || checkout.orderNo;
    if (checkout.kind === "manual") return { status: "manual", fallbackValue };

    const redirectUrl = safePaymentUrl(checkout.url || checkout.qrContent);
    if (redirectUrl) return openPaymentRedirect(redirectUrl, fallbackValue, openWindow, labels);

    if (checkout.kind === "form" && checkout.formHtml) {
        const popup = openCheckoutWindow(openWindow, labels);
        if (!popup) return { status: "blocked", fallbackValue };
        try {
            popup.document.open();
            popup.document.write(checkout.formHtml);
            popup.document.close();
            return { status: "opened" };
        } catch {
            closePopup(popup);
            return { status: "invalid", fallbackValue };
        }
    }

    return { status: "invalid", fallbackValue };
}

export function safePaymentUrl(value?: string) {
    const text = value?.trim();
    if (!text) return "";
    try {
        const url = new URL(text);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
    } catch {
        return "";
    }
}

function openPaymentRedirect(url: string, fallbackValue: string, openWindow: WindowOpen, labels: PaymentCheckoutWindowLabels): PaymentCheckoutOpenResult {
    const popup = openCheckoutWindow(openWindow, labels);
    if (!popup) return { status: "blocked", fallbackValue };
    try {
        popup.location.replace(url);
        return { status: "opened" };
    } catch {
        closePopup(popup);
        return { status: "invalid", fallbackValue };
    }
}

function openCheckoutWindow(openWindow: WindowOpen, labels: PaymentCheckoutWindowLabels = {}): CheckoutWindow | null {
    const popup = openWindow("about:blank", "_blank");
    if (!popup) return null;
    const checkoutWindow = popup as CheckoutWindow;
    checkoutWindow.opener = null;
    try {
        checkoutWindow.document.open();
        checkoutWindow.document.write(
            `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(labels.title || "Opening payment")}</title></head><body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:32px;color:#111827">${escapeHtml(labels.body || "Opening the payment page, please wait...")}</body></html>`,
        );
        checkoutWindow.document.close();
    } catch {
        // Some browser payment windows restrict document access; navigation can still continue.
    }
    return checkoutWindow;
}

function closePopup(popup: CheckoutWindow) {
    try {
        popup.close();
    } catch {
        // Ignore close failures from browser-managed payment windows.
    }
}

function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
