export function formatPaymentMethod(method) {
    if (!method) return "";

    if (method.toLowerCase() === "dispensed to patient") {
        return "Delivery";
    }

    return String(method).toUpperCase();
}
