import { useState } from "react";
import {
    UNIT_PIECE,
    clampQuantity,
    getPackSize,
    hasValidPackSize,
    isBoxUnit,
    toWholeNumber,
} from "@/lib/units";
import {
    expiryInfo,
    itemPieces,
    unitPriceFor,
    validateStockOutItems,
} from "../lib/stockOutValidation";

const emptyDraft = () => ({
    pd_id: "",
    products_qty_id: "",
    quantity_deducted: 1,
    unit_type: UNIT_PIECE,
    // Pieces-per-box for THIS transaction. Pre-filled from the product's
    // stored pack size when available, but always editable — a shipment's
    // real box count doesn't always match the product's master data, and
    // this is what actually gets deducted, not product.pack_size.
    pieces_per_box: "",
});

const sameId = (a, b) => String(a) === String(b);

function byExpiry(a, b) {
    const left = a.expiry ? String(a.expiry) : "9999-12-31";
    const right = b.expiry ? String(b.expiry) : "9999-12-31";

    return left.localeCompare(right);
}

/**
 * Draft picker + basket shared by the Stock Out create and edit forms.
 *
 * `items` / `setData` come from the owning useForm. Availability is always
 * live lot quantity minus the pieces the basket already commits to that lot,
 * so a lot can't be over-committed across several lines (the server checks
 * the same total per lot).
 */
export default function useStockOutBasket({
    items,
    setData,
    productMap,
    productsReady,
    errors = {},
    clearErrors,
}) {
    const [draft, setDraft] = useState(emptyDraft);

    const lotFor = (productId, batchId) =>
        (productMap[String(productId)]?.batches ?? []).find((lot) =>
            sameId(lot.id, batchId),
        ) ?? null;

    /** Pieces of this lot already in the basket, optionally skipping one line. */
    const piecesInBasket = (batchId, excludeIndex = -1) =>
        items.reduce(
            (sum, item, index) =>
                index !== excludeIndex && sameId(item.products_qty_id, batchId)
                    ? sum + itemPieces(item)
                    : sum,
            0,
        );

    /** Lot pieces still free after the basket (minus one line when editing it). */
    const remainingPieces = (batchId, lot, excludeIndex = -1) =>
        Math.max(
            toWholeNumber(lot?.quantity) - piecesInBasket(batchId, excludeIndex),
            0,
        );

    const unitsFromPieces = (pieces, unitType, piecesPerBoxValue) => {
        if (!isBoxUnit(unitType)) {
            return pieces;
        }

        const packSize = toWholeNumber(piecesPerBoxValue);

        return packSize >= 1 ? Math.floor(pieces / packSize) : 0;
    };

    /** Max whole units of `unitType` the lot can still give the draft line. */
    const ceilingFor = (productId, batchId, unitType, piecesPerBoxValue) => {
        const lot = lotFor(productId, batchId);

        if (!lot) {
            return 0;
        }

        return unitsFromPieces(
            remainingPieces(batchId, lot),
            unitType,
            piecesPerBoxValue,
        );
    };

    const isSelectableLot = (lot, remaining) =>
        (lot.status ?? "Active") === "Active" &&
        !expiryInfo(lot).expired &&
        remaining > 0;

    const lotRowsFor = (product) =>
        (product?.batches ?? [])
            .filter((lot) => toWholeNumber(lot.quantity) > 0)
            .slice()
            .sort(byExpiry)
            .map((lot) => {
                const inBasket = piecesInBasket(lot.id);
                const remaining = Math.max(toWholeNumber(lot.quantity) - inBasket, 0);
                const expiry = expiryInfo(lot);

                return {
                    lot,
                    inBasket,
                    remaining,
                    ...expiry,
                    selectable: isSelectableLot(lot, remaining),
                };
            });

    /** FEFO: earliest-expiry lot that can still give at least one piece. */
    const fefoLotId = (product) => {
        const row = lotRowsFor(product).find((candidate) => candidate.selectable);

        return row ? String(row.lot.id) : "";
    };

    const selectedProduct = draft.pd_id ? (productMap[draft.pd_id] ?? null) : null;
    const lotRows = lotRowsFor(selectedProduct);
    const selectableLots = lotRows.filter((row) => row.selectable);
    const selectedLotRow =
        lotRows.find((row) => sameId(row.lot.id, draft.products_qty_id)) ?? null;
    const selectedLot = selectedLotRow?.selectable ? selectedLotRow.lot : null;

    // Informational only — Box stays selectable either way, since
    // pieces-per-box is entered per transaction.
    const boxesUnavailable =
        selectedProduct !== null && !hasValidPackSize(selectedProduct);

    const effectivePiecesPerBox = isBoxUnit(draft.unit_type)
        ? toWholeNumber(draft.pieces_per_box)
        : 1;

    const maxQuantity = selectedLot
        ? ceilingFor(draft.pd_id, draft.products_qty_id, draft.unit_type, draft.pieces_per_box)
        : 0;

    const piecesPreview = selectedProduct
        ? (Number(draft.quantity_deducted) || 0) * Math.max(effectivePiecesPerBox, 0)
        : 0;

    const piecesLabel = selectedProduct
        ? isBoxUnit(draft.unit_type)
            ? effectivePiecesPerBox >= 1
                ? `${piecesPreview} ${piecesPreview === 1 ? "piece" : "pieces"} (${effectivePiecesPerBox} pcs/box)`
                : "Enter pcs per box to see how many pieces this will deduct"
            : `${piecesPreview} ${piecesPreview === 1 ? "piece" : "pieces"}`
        : "";

    const draftUnitPrice = selectedProduct ? unitPriceFor(selectedProduct, draft.unit_type) : null;
    const draftLineTotal =
        draftUnitPrice !== null ? draftUnitPrice * (Number(draft.quantity_deducted) || 0) : null;

    const reclamp = (current, overrides) => {
        const next = { ...current, ...overrides };

        return clampQuantity(current.quantity_deducted, {
            max: ceilingFor(next.pd_id, next.products_qty_id, next.unit_type, next.pieces_per_box),
        });
    };

    const updateDraft = (field, value) => {
        setDraft((current) => {
            const next = { ...current, [field]: value };

            if (field === "pd_id") {
                const product = value ? (productMap[String(value)] ?? null) : null;

                next.products_qty_id = product ? fefoLotId(product) : "";
                next.unit_type = UNIT_PIECE;
                next.pieces_per_box = "";
                next.quantity_deducted = next.products_qty_id
                    ? clampQuantity(1, {
                          max: ceilingFor(value, next.products_qty_id, UNIT_PIECE, ""),
                      })
                    : 1;

                return next;
            }

            if (field === "products_qty_id") {
                next.quantity_deducted = reclamp(current, { products_qty_id: value });

                return next;
            }

            if (field === "unit_type") {
                if (isBoxUnit(value)) {
                    // Pre-fill from the product's pack size the first time
                    // Box is chosen for this row; leave typed values alone.
                    if (!current.pieces_per_box) {
                        const product = current.pd_id ? (productMap[current.pd_id] ?? null) : null;
                        const defaultPack = product ? getPackSize(product) : 0;
                        next.pieces_per_box = defaultPack >= 1 ? String(defaultPack) : "";
                    }
                } else {
                    next.pieces_per_box = "";
                }

                next.quantity_deducted = reclamp(current, {
                    unit_type: value,
                    pieces_per_box: next.pieces_per_box,
                });

                return next;
            }

            if (field === "pieces_per_box") {
                next.quantity_deducted = reclamp(current, { pieces_per_box: value });

                return next;
            }

            if (field === "quantity_deducted") {
                if (value === "") {
                    next.quantity_deducted = "";

                    return next;
                }

                next.quantity_deducted = clampQuantity(value, {
                    min: 0,
                    max: ceilingFor(current.pd_id, current.products_qty_id, current.unit_type, current.pieces_per_box),
                    fallback: current.quantity_deducted || 0,
                });
            }

            return next;
        });
    };

    const normalizeQuantity = () => {
        setDraft((current) => ({
            ...current,
            quantity_deducted: reclamp(current, {}),
        }));
    };

    const updateQuantity = (delta) => {
        setDraft((current) => ({
            ...current,
            quantity_deducted: clampQuantity((Number(current.quantity_deducted) || 0) + delta, {
                max: ceilingFor(current.pd_id, current.products_qty_id, current.unit_type, current.pieces_per_box),
            }),
        }));
    };

    /** Why "Add to basket" is disabled, or null when it isn't. */
    const addBlockReason = (() => {
        if (!draft.pd_id) return "Search and pick a medicine first.";
        if (!selectedProduct) return "This medicine is not available in the selected branch.";
        if (selectableLots.length === 0) {
            return lotRows.length === 0
                ? "This medicine has no stock in the selected branch."
                : "Every lot of this medicine is expired, inactive or already fully in the basket.";
        }
        if (!selectedLot) return "Pick a lot from the list.";
        if (isBoxUnit(draft.unit_type) && effectivePiecesPerBox < 1) {
            return "Enter how many pieces are in one box.";
        }
        if (maxQuantity < 1) {
            return isBoxUnit(draft.unit_type)
                ? `Only ${selectedLotRow.remaining} pieces left in this lot — not enough for one box of ${effectivePiecesPerBox}.`
                : "Nothing left in this lot after what is already in the basket.";
        }
        if (!(Number(draft.quantity_deducted) >= 1)) return "Enter a quantity of at least 1.";
        if (Number(draft.quantity_deducted) > maxQuantity) return `Only ${maxQuantity} available in this lot.`;

        return null;
    })();

    const canAddToBasket = addBlockReason === null;

    const clearItemErrors = () => {
        const keys = Object.keys(errors).filter((key) => key === "items" || key.startsWith("items."));

        if (keys.length > 0) {
            clearErrors?.(...keys);
        }
    };

    const addItemToBasket = () => {
        if (!canAddToBasket) {
            return;
        }

        const quantity = Number(draft.quantity_deducted);
        const piecesPerBox = isBoxUnit(draft.unit_type) ? effectivePiecesPerBox : null;

        setData((current) => {
            // Same medicine, lot, unit and box size: grow the existing line
            // instead of adding a second one for the same thing.
            const existingIndex = current.items.findIndex(
                (item) =>
                    sameId(item.pd_id, draft.pd_id) &&
                    sameId(item.products_qty_id, draft.products_qty_id) &&
                    isBoxUnit(item.unit_type) === isBoxUnit(draft.unit_type) &&
                    toWholeNumber(item.pieces_per_box) === toWholeNumber(piecesPerBox),
            );

            if (existingIndex !== -1) {
                return {
                    ...current,
                    items: current.items.map((item, index) => {
                        if (index !== existingIndex) return item;

                        const merged = {
                            ...item,
                            quantity_deducted: (Number(item.quantity_deducted) || 0) + quantity,
                        };

                        return { ...merged, pieces_preview: itemPieces(merged) };
                    }),
                };
            }

            return {
                ...current,
                items: [
                    ...current.items,
                    {
                        pd_id: draft.pd_id,
                        products_qty_id: draft.products_qty_id,
                        lot_number: selectedLot?.lot_number ?? "",
                        quantity_deducted: quantity,
                        unit_type: draft.unit_type,
                        pieces_per_box: piecesPerBox,
                        pieces_preview: piecesPreview,
                    },
                ],
            };
        });
        clearItemErrors();
        setDraft(emptyDraft());
    };

    const removeItemFromBasket = (index) => {
        setData((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }));

        // Per-item server errors are keyed by position ("items.2.pd_id");
        // once rows shift they would point at the wrong medicine.
        clearItemErrors();
    };

    /** Inline edit of a basket line's quantity or pieces-per-box. */
    const updateItem = (index, field, value) => {
        setData((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => {
                if (itemIndex !== index) return item;

                const next = { ...item, [field]: value };

                return { ...next, pieces_preview: itemPieces(next) };
            }),
        }));

        const prefix = `items.${index}.`;
        const keys = Object.keys(errors).filter((key) => key.startsWith(prefix));

        if (keys.length > 0) {
            clearErrors?.(...keys);
        }
    };

    /** On blur: turn "3.7" / " 4 " into a whole number; leave "" for validation. */
    const normalizeItem = (index, field) => {
        const raw = String(items[index]?.[field] ?? "").trim();

        if (raw === "") return;

        const whole = toWholeNumber(raw, NaN);

        if (Number.isFinite(whole) && String(whole) !== raw) {
            updateItem(index, field, whole);
        }
    };

    /** Lot for a line: object, null when it's gone, undefined while loading. */
    const lotForItem = (index) => {
        if (!productsReady) return undefined;

        const item = items[index];

        return item ? lotFor(item.pd_id, item.products_qty_id) : undefined;
    };

    /** Max units for a line after the other lines take their share of the lot. */
    const ceilingForItem = (index) => {
        const item = items[index];
        const lot = item && productsReady ? lotFor(item.pd_id, item.products_qty_id) : null;

        if (!lot) return null;

        if (isBoxUnit(item.unit_type) && toWholeNumber(item.pieces_per_box) < 1) return null;

        return unitsFromPieces(
            remainingPieces(item.products_qty_id, lot, index),
            item.unit_type,
            item.pieces_per_box,
        );
    };

    const itemErrors = validateStockOutItems(items, {
        lotForItem,
        productForItem: (index) => productMap[String(items[index]?.pd_id)] ?? null,
    });

    const basketRows = items.map((item, index) => {
        const product = productMap[String(item.pd_id)] ?? null;
        const lot = productsReady ? lotFor(item.pd_id, item.products_qty_id) : null;
        const unitPrice = product ? unitPriceFor(product, item.unit_type) : null;
        const quantity = toWholeNumber(item.quantity_deducted);

        return {
            item,
            index,
            product,
            lot,
            expiry: lot ? expiryInfo(lot) : expiryInfo(null),
            pieces: itemPieces(item),
            unitPrice,
            lineTotal: unitPrice !== null ? unitPrice * quantity : null,
            max: ceilingForItem(index),
        };
    });

    const totals = {
        lines: basketRows.length,
        pieces: basketRows.reduce((sum, row) => sum + row.pieces, 0),
        amount: basketRows.reduce((sum, row) => sum + (row.lineTotal ?? 0), 0),
        missingPrices: basketRows.some((row) => row.lineTotal === null),
    };

    const resetDraft = () => setDraft(emptyDraft());

    return {
        draft,
        updateDraft,
        updateQuantity,
        normalizeQuantity,
        resetDraft,
        selectedProduct,
        lotRows,
        selectableLots,
        selectedLot,
        selectedLotRow,
        maxQuantity,
        piecesPreview,
        piecesLabel,
        draftUnitPrice,
        draftLineTotal,
        boxesUnavailable,
        canAddToBasket,
        addBlockReason,
        addItemToBasket,
        removeItemFromBasket,
        updateItem,
        normalizeItem,
        itemErrors,
        basketRows,
        totals,
    };
}
