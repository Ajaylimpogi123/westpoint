/**
 * Shared unit-conversion helpers.
 *
 * Stock is stored in pieces; Box is a presentation unit that must be
 * multiplied by the product's pack_size. These helpers mirror
 * MedicineProduct::toPieces() on the server — when the two disagree the
 * operator sees one number and the database records another, so any change
 * here needs the same change there.
 */

export const UNIT_PIECE = "Piece";
export const UNIT_BOX = "Box";

export const UNIT_TYPES = [
    { value: UNIT_PIECE, label: "Piece" },
    { value: UNIT_BOX, label: "Box / Wholesale" },
];

/** Mirrors InventoryStockService::MAX_TRANSACTION_QUANTITY. */
export const MAX_TRANSACTION_QUANTITY = 1_000_000;

/** Comparison is case-insensitive because legacy rows stored "box". */
export function isBoxUnit(unitType) {
    return String(unitType ?? "").trim().toLowerCase() === "box";
}

export function unitLabel(unitType) {
    return isBoxUnit(unitType) ? "Box / Wholesale" : "Piece";
}

/**
 * Returns 0 rather than a fallback of 1 when pack_size is missing. Defaulting
 * to 1 client-side while the server refuses the conversion is what previously
 * let the two sides disagree silently.
 */
export function getPackSize(product) {
    const packSize = Number(product?.pack_size);

    return Number.isFinite(packSize) && packSize >= 1 ? Math.floor(packSize) : 0;
}

export function hasValidPackSize(product) {
    return getPackSize(product) >= 1;
}

/** Parse to a whole number, tolerating partially-typed and pasted input. */
export function toWholeNumber(value, fallback = 0) {
    const trimmed = String(value ?? "").trim();

    if (trimmed === "") {
        return fallback;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.floor(parsed);
}

export function clampQuantity(value, { min = 1, max = MAX_TRANSACTION_QUANTITY, fallback = min } = {}) {
    const parsed = toWholeNumber(value, fallback);
    const upper = Math.min(max, MAX_TRANSACTION_QUANTITY);

    if (upper < min) {
        return 0;
    }

    return Math.min(Math.max(parsed, min), upper);
}

/** Convert a quantity in `unitType` to pieces. Returns 0 for an unusable pack size. */
export function toPieces(product, quantity, unitType) {
    const qty = Math.max(toWholeNumber(quantity), 0);

    if (!isBoxUnit(unitType)) {
        return qty;
    }

    return getPackSize(product) * qty;
}

/** How many whole units of `unitType` the available pieces will cover. */
export function maxQuantityForUnit(availablePieces, product, unitType) {
    const pieces = Math.max(toWholeNumber(availablePieces), 0);

    if (!isBoxUnit(unitType)) {
        return pieces;
    }

    const packSize = getPackSize(product);

    return packSize >= 1 ? Math.floor(pieces / packSize) : 0;
}

/** "500 pieces (5 boxes x 100 pcs)" style hint for a box-denominated input. */
export function describePieces(product, quantity, unitType) {
    const pieces = toPieces(product, quantity, unitType);
    const suffix = pieces === 1 ? "piece" : "pieces";

    if (!isBoxUnit(unitType)) {
        return `${pieces} ${suffix}`;
    }

    if (!hasValidPackSize(product)) {
        return "Pack size not set — this medicine cannot be transacted in boxes";
    }

    return `${pieces} ${suffix} (${getPackSize(product)} pcs/box)`;
}
