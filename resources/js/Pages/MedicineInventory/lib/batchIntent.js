/**
 * Predicts whether a stock-in line will merge into an existing batch or create
 * a new row. Mirrors InventoryStockService::stockInIntent() on the server.
 */

export const BATCH_INTENT = {
    INCOMPLETE: "incomplete",
    NEW: "new",
    MERGE: "merge",
    CONFLICT: "conflict",
    SHELF_SPLIT: "shelf_split",
};

function normalizeOptionalString(value) {
    const trimmed = String(value ?? "").trim();

    return trimmed === "" ? null : trimmed;
}

function normalizeDate(value) {
    if (!value) {
        return null;
    }

    return String(value).slice(0, 10);
}

function shelvesMatch(stored, entered) {
    const a = normalizeOptionalString(stored);
    const b = normalizeOptionalString(entered);

    if (a === null && b === null) {
        return true;
    }

    return a === b;
}

function datesMatch(stored, entered) {
    return normalizeDate(stored) === normalizeDate(entered);
}

function formatDisplayDate(value) {
    const normalized = normalizeDate(value);

    if (!normalized) {
        return "—";
    }

    const [year, month, day] = normalized.split("-");

    return `${month}/${day}/${year}`;
}

function batchesForProduct(product) {
    return (product?.batches ?? []).filter(
        (batch) =>
            batch.status !== "Deleted" && batch.status !== "Expired",
    );
}

function findExactMatch(batches, lot, expiry, shelf) {
    return batches.find(
        (batch) =>
            normalizeOptionalString(batch.lot_number) === lot &&
            datesMatch(batch.expiry, expiry) &&
            shelvesMatch(batch.shelf_number, shelf),
    );
}

/**
 * @param {object|null} product  Medicine with optional `batches` array
 * @param {{ batch_number: string, expiry_date: string, shelf_number?: string }} draft
 */
export function resolveBatchIntent(product, draft) {
    const lot = normalizeOptionalString(draft.batch_number);

    if (!product || !lot) {
        return { mode: BATCH_INTENT.INCOMPLETE, message: null };
    }

    const batches = batchesForProduct(product);
    const expiry = normalizeDate(draft.expiry_date);
    const shelf = normalizeOptionalString(draft.shelf_number);

    const sameLot = batches.filter(
        (batch) => normalizeOptionalString(batch.lot_number) === lot,
    );

    if (sameLot.length === 0) {
        return {
            mode: BATCH_INTENT.NEW,
            message: "Creates a new batch.",
        };
    }

    if (!expiry) {
        return {
            mode: BATCH_INTENT.INCOMPLETE,
            message:
                "Enter the expiry date to see whether this adds to an existing batch.",
        };
    }

    const exactMatch = findExactMatch(sameLot, lot, expiry, shelf);

    if (exactMatch) {
        const shelfLabel = exactMatch.shelf_number
            ? ` · shelf ${exactMatch.shelf_number}`
            : "";

        return {
            mode: BATCH_INTENT.MERGE,
            existingBatch: exactMatch,
            message: `Adds to existing batch — currently ${Number(exactMatch.quantity) || 0} pcs${shelfLabel}, exp ${formatDisplayDate(exactMatch.expiry)}.`,
        };
    }

    const sameLotAndExpiry = sameLot.filter((batch) =>
        datesMatch(batch.expiry, expiry),
    );

    if (sameLotAndExpiry.length === 0) {
        const onFile = sameLot[0];

        return {
            mode: BATCH_INTENT.CONFLICT,
            existingBatch: onFile,
            message: `Lot ${lot} already exists with expiry ${formatDisplayDate(onFile.expiry)}. You entered ${formatDisplayDate(expiry)} — this will create a separate batch.`,
            requiresConfirmation: true,
        };
    }

    const onFile = sameLotAndExpiry[0];
    const shelfLabel = onFile.shelf_number
        ? `shelf ${onFile.shelf_number}`
        : "no shelf";

    return {
        mode: BATCH_INTENT.SHELF_SPLIT,
        existingBatch: onFile,
        message: `Same lot and expiry exist on ${shelfLabel}. A different shelf will create a separate batch row.`,
        requiresConfirmation: false,
    };
}

/** Existing in-stock batches for the selected product, by expiry. */
export function existingLotsForProduct(product) {
    return batchesForProduct(product)
        .filter((batch) => {
            if (!normalizeOptionalString(batch.lot_number)) {
                return false;
            }

            // Empty / inactive lots clutter the picker; typing the lot still
            // merges if lot + expiry + shelf match.
            return (Number(batch.quantity) || 0) > 0;
        })
        .sort((a, b) => {
            const aDate = normalizeDate(a.expiry) ?? "";
            const bDate = normalizeDate(b.expiry) ?? "";

            return aDate.localeCompare(bDate);
        });
}

/** Fill draft fields from an on-hand batch (guarantees a merge when received). */
export function batchToDraftFields(batch) {
    return {
        batch_number: batch.lot_number ?? "",
        expiry_date: normalizeDate(batch.expiry) ?? "",
        shelf_number: batch.shelf_number ?? "",
    };
}
