export function formatPaymentMethod(method) {
    if (!method) return "";

    const normalized = method.toLowerCase();

    if (normalized === "dispensed to patient") {
        return "Delivery";
    }

    if (normalized === "debit_card") {
        return "Debit Card";
    }

    if (normalized === "credit_card") {
        return "Credit Card";
    }

    return String(method).toUpperCase();
}
