import { useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";
import {
    UNIT_PIECE,
    UNIT_TYPES,
    clampQuantity,
    describePieces,
    hasValidPackSize,
    isBoxUnit,
    maxQuantityForUnit,
    toPieces,
} from "@/lib/units";
import { newIdempotencyKey } from "@/lib/idempotency";

const TRANSACTION_SUBTYPES = ["Dispensed to patient", "Returned to supplier"];

const emptyDraft = () => ({
    pd_id: "",
    products_qty_id: "",
    quantity_deducted: 1,
    unit_type: UNIT_PIECE,
});

const emptyForm = (branchId) => ({
    idempotency_key: newIdempotencyKey(),
    transaction_subtype: "",
    branch_id: branchId ? String(branchId) : "",
    patient_reference: "",
    issued_by: "",
    remarks: "",
    delivered_to: "",
    delivered_to_address: "",
    items: [],
});

export default function useStockOut({ branchId, products }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);

    const { data, setData, post, errors, processing, reset, clearErrors } =
        useForm(emptyForm(branchId));

    const productMap = useMemo(() => {
        return Object.fromEntries(
            (products ?? []).map((product) => [String(product.id), product]),
        );
    }, [products]);

    const selectedProduct = draft.pd_id
        ? productMap[draft.pd_id] ?? null
        : null;

    const availableLots = (selectedProduct?.batches ?? []).filter(
        (lot) =>
            (lot.status ?? "Active") === "Active" &&
            Number(lot.quantity) > 0,
    );

    // Lots are addressed by primary key, not lot number: the same lot number
    // can exist on several batches with different expiries or shelves, and
    // matching by name could target a different batch than the one shown.
    const selectedLot = draft.products_qty_id
        ? availableLots.find(
              (lot) => String(lot.id) === String(draft.products_qty_id),
          ) ?? null
        : null;

    const boxesUnavailable =
        selectedProduct !== null && !hasValidPackSize(selectedProduct);

    const maxQuantity = selectedLot
        ? maxQuantityForUnit(
              selectedLot.quantity,
              selectedProduct,
              draft.unit_type,
          )
        : 0;

    const piecesPreview = selectedProduct
        ? toPieces(selectedProduct, draft.quantity_deducted, draft.unit_type)
        : 0;

    const piecesLabel = selectedProduct
        ? describePieces(
              selectedProduct,
              draft.quantity_deducted,
              draft.unit_type,
          )
        : "";

    const lotFor = (productId, batchId) => {
        const lots = productMap[productId]?.batches ?? [];

        return (
            lots.find((lot) => String(lot.id) === String(batchId)) ?? null
        );
    };

    const ceilingFor = (productId, batchId, unitType) => {
        const lot = lotFor(productId, batchId);

        if (!lot) {
            return 0;
        }

        return maxQuantityForUnit(lot.quantity, productMap[productId], unitType);
    };

    const openModal = () => {
        clearErrors();
        setDraft(emptyDraft());
        setData(emptyForm(branchId));
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setDraft(emptyDraft());
        reset();
        clearErrors();
    };

    const updateDraft = (field, value) => {
        setDraft((current) => {
            const next = { ...current, [field]: value };

            if (field === "pd_id") {
                next.products_qty_id = "";
                next.quantity_deducted = 1;
                next.unit_type = UNIT_PIECE;

                return next;
            }

            if (field === "products_qty_id") {
                next.quantity_deducted = clampQuantity(
                    current.quantity_deducted,
                    {
                        max: ceilingFor(current.pd_id, value, current.unit_type),
                    },
                );

                return next;
            }

            // Changing the unit changes what the number means, so the entered
            // quantity has to be re-clamped against the new ceiling rather
            // than carried across as-is.
            if (field === "unit_type") {
                next.quantity_deducted = clampQuantity(
                    current.quantity_deducted,
                    {
                        max: ceilingFor(
                            current.pd_id,
                            current.products_qty_id,
                            value,
                        ),
                    },
                );

                return next;
            }

            if (field === "quantity_deducted") {
                // Allow the field to be temporarily empty while the user is
                // clearing it to type a new value. It is normalized on blur
                // and re-validated before it can be added to the basket.
                if (value === "") {
                    next.quantity_deducted = "";

                    return next;
                }

                const max = ceilingFor(
                    current.pd_id,
                    current.products_qty_id,
                    current.unit_type,
                );

                next.quantity_deducted = clampQuantity(value, {
                    min: 0,
                    max,
                    fallback: current.quantity_deducted || 0,
                });
            }

            return next;
        });
    };

    const normalizeQuantity = () => {
        setDraft((current) => ({
            ...current,
            quantity_deducted: clampQuantity(current.quantity_deducted, {
                max: ceilingFor(
                    current.pd_id,
                    current.products_qty_id,
                    current.unit_type,
                ),
            }),
        }));
    };

    const updateQuantity = (delta) => {
        setDraft((current) => {
            const base = Number(current.quantity_deducted) || 0;

            return {
                ...current,
                quantity_deducted: clampQuantity(base + delta, {
                    max: ceilingFor(
                        current.pd_id,
                        current.products_qty_id,
                        current.unit_type,
                    ),
                }),
            };
        });
    };

    const canAddToBasket =
        Boolean(draft.pd_id) &&
        Boolean(draft.products_qty_id) &&
        Number(draft.quantity_deducted) >= 1 &&
        maxQuantity >= 1 &&
        Number(draft.quantity_deducted) <= maxQuantity &&
        !(isBoxUnit(draft.unit_type) && boxesUnavailable);

    const addItemToBasket = () => {
        if (!canAddToBasket) {
            return;
        }

        setData("items", [
            ...data.items,
            {
                pd_id: draft.pd_id,
                products_qty_id: draft.products_qty_id,
                lot_number: selectedLot?.lot_number ?? "",
                quantity_deducted: Number(draft.quantity_deducted),
                unit_type: draft.unit_type,
                pieces_preview: piecesPreview,
            },
        ]);
        setDraft(emptyDraft());
    };

    const removeItemFromBasket = (index) => {
        setData(
            "items",
            data.items.filter((_, itemIndex) => itemIndex !== index),
        );
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (processing || data.items.length === 0) {
            return;
        }

        post(route("stock-out.store"), {
            onSuccess: () => closeModal(),
            preserveScroll: true,
            only: ["stockOuts", "medicines", "products", "movementLogs"],
        });
    };

    return {
        TRANSACTION_SUBTYPES,
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        updateQuantity,
        normalizeQuantity,
        selectedProduct,
        availableLots,
        selectedLot,
        maxQuantity,
        piecesPreview,
        piecesLabel,
        boxesUnavailable,
        canAddToBasket,
        productMap,
        products: products ?? [],
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
        clearErrors,
    };
}
