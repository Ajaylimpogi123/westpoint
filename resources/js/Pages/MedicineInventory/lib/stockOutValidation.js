/**
 * Client-side checks for the Stock Out create/edit forms.
 *
 * These mirror the server rules in StockOutController (see the handoff
 * contract `.claude/handoff/stock-out-validation-basket.md`). The server is
 * still the authority; this only lets the operator see problems before
 * submitting. Keep the TIN pattern and the "required when delivering to a
 * customer" list in step with the contract.
 */
import { isBoxUnit, toWholeNumber } from "@/lib/units";
import { toDate } from "@/lib/dates";

export const DELIVERY_TO_CUSTOMER = "Delivery to Customer";
export const RETURNED_TO_SUPPLIER = "Returned to supplier";
export const TRANSACTION_SUBTYPES = [DELIVERY_TO_CUSTOMER, RETURNED_TO_SUPPLIER];

/** Lots expiring within this many days are flagged in the lot list. */
export const EXPIRING_SOON_DAYS = 30;

/** Mirrors the server TIN rule exactly (contract). Empty is allowed: TIN is optional. */
export const TIN_PATTERN = /^\d{3}-?\d{3}-?\d{3}(?:-?\d{3,5})?$/;
export const TIN_MESSAGE =
    "Enter the TIN as 9 digits with an optional 3-5 digit branch code, e.g. 123-456-789 or 123-456-789-00000.";

/** Recipient fields the server requires for "Delivery to Customer" (contract). */
export const DELIVERY_REQUIRED_FIELDS = {
    delivered_to: "Enter who the delivery is for. It is printed on the Delivery Receipt.",
};

/** Length limits from the contract, checked before submit. */
const MAX_LENGTHS = {
    issued_by: [255, "Issued by may not be longer than 255 characters."],
    delivered_to: [255, "Delivered to may not be longer than 255 characters."],
    delivered_to_address: [500, "The delivery address may not be longer than 500 characters."],
    delivered_to_tin: [50, "The TIN may not be longer than 50 characters."],
    patient_reference: [255, "Patient reference may not be longer than 255 characters."],
    remarks: [2000, "Remarks may not be longer than 2000 characters."],
};

/** Order fields are checked/focused in, top of the form to the bottom. */
export const HEADER_FIELD_ORDER = [
    "transaction_subtype",
    "branch_id",
    "patient_reference",
    "delivered_to",
    "delivered_to_tin",
    "delivered_to_address",
    "issued_by",
    "remarks",
    "items",
];

const ITEM_FIELDS = [
    "pd_id",
    "products_qty_id",
    "unit_type",
    "pieces_per_box",
    "quantity_deducted",
];

const today = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return now;
};

/**
 * Expiry arrives as an ISO date-time ("2027-10-29T00:00:00.000000Z"); only
 * the calendar date matters, so take the date part and read it as local.
 */
function expiryDate(expiry) {
    if (!expiry) return null;

    const match = String(expiry).match(/^(\d{4}-\d{2}-\d{2})/);

    return toDate(match ? match[1] : expiry);
}

/**
 * { expired, expiringSoon, daysLeft } for a lot. Pass the lot to honour the
 * server's `is_expired` flag (expired but not yet marked by the nightly job).
 */
export function expiryInfo(expiryOrLot) {
    const isLot = expiryOrLot !== null && typeof expiryOrLot === "object";
    const date = expiryDate(isLot ? expiryOrLot.expiry : expiryOrLot);
    const flagged = isLot && Boolean(expiryOrLot.is_expired);

    if (!date) {
        return { expired: flagged, expiringSoon: false, daysLeft: null };
    }

    const daysLeft = Math.round((date.getTime() - today().getTime()) / 86_400_000);

    return {
        expired: flagged || daysLeft < 0,
        expiringSoon: !flagged && daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS,
        daysLeft,
    };
}

/** Lot expiry for display, e.g. "10-29-2027". */
export function formatExpiry(expiry) {
    const date = expiryDate(expiry);

    if (!date) return "—";

    const pad = (value) => String(value).padStart(2, "0");

    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`;
}

/** Price the server stores as unit_price: wholesale per box, retail per piece. */
export function unitPriceFor(product, unitType) {
    const raw = isBoxUnit(unitType) ? product?.wholesale_price : product?.retail_price;
    const price = Number(raw);

    return Number.isFinite(price) ? price : null;
}

/** Pieces a basket line deducts (Box uses the line's own pieces-per-box). */
export function itemPieces(item) {
    const qty = Math.max(toWholeNumber(item?.quantity_deducted), 0);

    return isBoxUnit(item?.unit_type) ? qty * Math.max(toWholeNumber(item?.pieces_per_box), 0) : qty;
}

export function formatMoney(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "—";
    }

    return `₱${Number(value).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Header checks. `checkSubtype` / `checkBranch` are false on the edit form,
 * where both are fixed. `subtype` decides whether recipient fields apply.
 */
export function validateStockOutHeader(data, { subtype, checkSubtype = true, checkBranch = true } = {}) {
    const errors = {};

    if (checkSubtype && !TRANSACTION_SUBTYPES.includes(data.transaction_subtype)) {
        errors.transaction_subtype =
            "Choose a transaction type: Delivery to Customer or Returned to supplier.";
    }

    if (checkBranch && !data.branch_id) {
        errors.branch_id = "Choose the source branch.";
    }

    Object.entries(MAX_LENGTHS).forEach(([field, [max, message]]) => {
        if (String(data[field] ?? "").trim().length > max) {
            errors[field] = message;
        }
    });

    if (!String(data.issued_by ?? "").trim()) {
        errors.issued_by = "Enter who issued this stock-out.";
    }

    if (subtype === DELIVERY_TO_CUSTOMER) {
        Object.entries(DELIVERY_REQUIRED_FIELDS).forEach(([field, message]) => {
            if (!String(data[field] ?? "").trim()) {
                errors[field] = message;
            }
        });
    }

    const tin = String(data.delivered_to_tin ?? "").trim();

    if (tin !== "" && !errors.delivered_to_tin && !TIN_PATTERN.test(tin)) {
        errors.delivered_to_tin = TIN_MESSAGE;
    }

    if (!data.items || data.items.length === 0) {
        errors.items = "Add at least one medicine to the basket.";
    }

    return errors;
}

const MAX_UNITS = 1_000_000; // MAX_TRANSACTION_QUANTITY

function wholeNumberIn(raw, min, max) {
    const value = Number(String(raw ?? "").trim());

    return String(raw ?? "").trim() !== "" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Per-line checks, mirroring the server (contract "Validation errors"):
 * quantity and pieces-per-box rules, lot still present and not expired,
 * and lot sufficiency as a running total — the line at which the pieces
 * of one lot first exceed what's on hand gets the error, later lines of the
 * same lot don't repeat it.
 *
 * `lotForItem(index)` returns the lot, null when it's gone from the branch,
 * or undefined while products are still loading (lot checks are skipped).
 * `productForItem(index)` gives the medicine for nicer messages.
 */
export function validateStockOutItems(items, { lotForItem, productForItem } = {}) {
    const errors = {};
    const runningPieces = {};
    const linesByLot = {};
    const flaggedLots = new Set();

    (items ?? []).forEach((item, index) => {
        const line = `Line ${index + 1}`;
        const key = (field) => `items.${index}.${field}`;
        const rawQty = String(item.quantity_deducted ?? "").trim();
        const box = isBoxUnit(item.unit_type);
        let fieldsOk = true;

        if (rawQty === "") {
            errors[key("quantity_deducted")] = `${line}: enter a quantity.`;
            fieldsOk = false;
        } else if (!Number.isInteger(Number(rawQty))) {
            errors[key("quantity_deducted")] = `${line}: quantity must be a whole number.`;
            fieldsOk = false;
        } else if (Number(rawQty) < 1) {
            errors[key("quantity_deducted")] = `${line}: quantity must be at least 1.`;
            fieldsOk = false;
        } else if (Number(rawQty) > MAX_UNITS) {
            errors[key("quantity_deducted")] = `${line}: quantity may not be more than 1,000,000.`;
            fieldsOk = false;
        }

        if (box) {
            const rawPack = String(item.pieces_per_box ?? "").trim();

            if (rawPack === "") {
                errors[key("pieces_per_box")] = `${line}: enter how many pieces are in one box.`;
                fieldsOk = false;
            } else if (!wholeNumberIn(rawPack, 1, MAX_UNITS)) {
                errors[key("pieces_per_box")] =
                    `${line}: pieces per box must be a whole number from 1 to 1,000,000.`;
                fieldsOk = false;
            }
        }

        if (!fieldsOk || !lotForItem) {
            return;
        }

        const lot = lotForItem(index);

        if (lot === undefined) {
            return;
        }

        const medName = productForItem?.(index)?.med_name ?? "this medicine";

        if (lot === null) {
            errors[key("products_qty_id")] =
                `${line}: the selected lot is not available for ${medName} in this branch. Remove it from the list.`;

            return;
        }

        if (expiryInfo(lot).expired) {
            errors[key("products_qty_id")] =
                `${line}: lot ${lot.lot_number} of ${medName} expired on ${formatExpiry(lot.expiry)} and cannot be dispensed.`;

            return;
        }

        if ((lot.status ?? "Active") !== "Active") {
            errors[key("products_qty_id")] =
                `${line}: lot ${lot.lot_number} of ${medName} is ${String(lot.status).toLowerCase()} and cannot be dispensed.`;

            return;
        }

        const lotKey = String(lot.id);
        const pieces = itemPieces(item);
        const available = Math.max(toWholeNumber(lot.quantity), 0);

        linesByLot[lotKey] = [...(linesByLot[lotKey] ?? []), index + 1];
        runningPieces[lotKey] = (runningPieces[lotKey] ?? 0) + pieces;

        if (flaggedLots.has(lotKey) || runningPieces[lotKey] <= available) {
            return;
        }

        flaggedLots.add(lotKey);

        const lines = linesByLot[lotKey];

        errors[key("quantity_deducted")] =
            lines.length === 1
                ? `${line}: ${pieces} pieces of ${medName} exceed the ${available} pieces available in lot ${lot.lot_number}.`
                : `${line}: lines ${lines.slice(0, -1).join(", ")} and ${lines[lines.length - 1]} together take ${runningPieces[lotKey]} pieces of ${medName} from lot ${lot.lot_number}, but only ${available} pieces are available.`;
    });

    return errors;
}

/** First message among `items.<index>.*`, in field order. */
export function itemErrorFor(errors, index) {
    for (const field of ITEM_FIELDS) {
        const message = errors[`items.${index}.${field}`];

        if (message) {
            return message;
        }
    }

    const prefix = `items.${index}.`;
    const other = Object.keys(errors).find((key) => key.startsWith(prefix));

    return other ? errors[other] : null;
}

/**
 * Errors that don't belong to a rendered field (e.g. `idempotency_key`,
 * `items.7.x` for a row that no longer exists, or anything unexpected).
 * They are shown at the top of the form so nothing is silently dropped.
 */
export function generalErrors(errors, { fieldKeys = HEADER_FIELD_ORDER, itemCount = 0 } = {}) {
    return Object.entries(errors)
        .filter(([key, message]) => {
            if (!message) return false;
            if (fieldKeys.includes(key)) return false;

            const match = key.match(/^items\.(\d+)\./);

            return !(match && Number(match[1]) < itemCount);
        })
        .map(([key, message]) => ({ key, message }));
}

/** Error keys in on-screen order: header fields, then basket rows. */
export function orderedErrorKeys(errors) {
    const keys = Object.keys(errors).filter((key) => errors[key]);
    const rank = (key) => {
        const headerIndex = HEADER_FIELD_ORDER.indexOf(key);

        if (headerIndex !== -1) {
            return headerIndex;
        }

        const match = key.match(/^items\.(\d+)\./);

        return match ? 100 + Number(match[1]) : -1; // unknown keys first: they show at the top
    };

    return keys.sort((a, b) => rank(a) - rank(b));
}

/**
 * Scroll to and focus the element for an error key. Fields carry
 * `data-field="<key>"`; basket rows carry `data-field="items.<i>"`.
 */
export function focusFirstError(container, errors) {
    if (!container) return;

    const [first] = orderedErrorKeys(errors);

    if (!first) return;

    const rowMatch = first.match(/^(items\.\d+)\.(.+)$/);
    const selectors = rowMatch
        ? [`[data-field="${first}"]`, `[data-field="${rowMatch[1]}"]`]
        : [`[data-field="${first}"]`, '[data-field="general-errors"]'];

    const target = selectors.map((selector) => container.querySelector(selector)).find(Boolean);

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    const focusable = target.matches("input, select, textarea, button")
        ? target
        : target.querySelector("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");

    focusable?.focus({ preventScroll: true });
}
