import { paymentMethodLabel } from "@/lib/paymentMethods";

/** Kept as a named export so existing History imports keep working. */
export function formatPaymentMethod(method) {
    return paymentMethodLabel(method);
}
