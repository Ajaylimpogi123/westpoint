/**
 * Shared payment-method list and labels.
 *
 * PAYMENT_METHODS mirrors the POS cases of App\Enums\PaymentMethod (what
 * pos.store accepts). When the server adds or renames a method, update this
 * list too so the POS, History, receipts and Dashboard show the same label
 * for the same stored value. The Dashboard filter itself uses the server's
 * `paymentMethods` prop.
 */

/** Sentinel filter value meaning "no payment-method filter". */
export const ALL_PAYMENT_METHODS = "all";

export const PAYMENT_METHODS = [
    { value: "cash", label: "Cash" },
    { value: "gcash", label: "GCash" },
    { value: "debit_card", label: "Debit Card" },
    { value: "credit_card", label: "Credit Card" },
    { value: "PH_GAMOT", label: "PH GAMOT" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "others", label: "Others" },
];

/**
 * Values that are not POS checkout options. Stock Out "Delivery to Customer"
 * sales are stored as "Delivery to Customer" (legacy rows: "Dispensed to
 * patient"); the dashboard filter uses the slug "delivery_to_customer".
 * "Dispensed to patient" keeps its historical "Delivery" label in History.
 */
const NON_POS_LABELS = {
    "dispensed to patient": "Delivery",
    "delivery to customer": "Delivery to Customer",
    delivery_to_customer: "Delivery to Customer",
};

const LABELS_BY_KEY = PAYMENT_METHODS.reduce(
    (labels, method) => ({ ...labels, [method.value.toLowerCase()]: method.label }),
    { ...NON_POS_LABELS },
);

/**
 * Human label for a stored payment_method value. Lookup is case-insensitive
 * because PH_GAMOT is stored upper-case while the rest are lower-case.
 * Unknown values fall back to a title-cased version of the raw value.
 */
export function paymentMethodLabel(method) {
    if (method == null || method === "") {
        return "";
    }

    const raw = String(method).trim();
    const known = LABELS_BY_KEY[raw.toLowerCase()];

    if (known) {
        return known;
    }

    return raw
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalise a server-provided [{value,label}] list, falling back to the local
 * mirror when the prop is missing or empty.
 */
export function resolvePaymentMethodOptions(serverOptions) {
    if (!Array.isArray(serverOptions) || serverOptions.length === 0) {
        return PAYMENT_METHODS;
    }

    return serverOptions
        .filter((option) => option && option.value != null && option.value !== "")
        .map((option) => ({
            value: String(option.value),
            label: option.label || paymentMethodLabel(option.value),
        }));
}
