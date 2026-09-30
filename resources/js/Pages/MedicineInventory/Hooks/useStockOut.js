import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";
import {
    UNIT_PIECE,
    UNIT_TYPES,
    clampQuantity,
    getPackSize,
    hasValidPackSize,
    isBoxUnit,
    toWholeNumber,
} from "@/lib/units";
import { newIdempotencyKey } from "@/lib/idempotency";
import { fetchBranchProducts } from "../lib/inventoryMedicinesApi";

const TRANSACTION_SUBTYPES = ["Delivery to Customer", "Returned to supplier"];

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

export default function useStockOut({
    branchId,
    products: initialProducts = [],
    canAssignBranch = false,
    branches = [],
}) {
    const defaultBranchId = branchId ?? branches[0]?.id ?? null;

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);
    const [products, setProducts] = useState(initialProducts ?? []);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState(null);

    const { data, setData, post, errors, processing, reset, clearErrors } =
        useForm(emptyForm(defaultBranchId));

    const loadProductsForBranch = useCallback(async (targetBranchId) => {
        if (!targetBranchId) {
            setProducts([]);
            return;
        }

        setProductsLoading(true);
        setProductsError(null);

        try {
            const response = await fetchBranchProducts(targetBranchId);
            setProducts(response.products ?? []);
        } catch {
            setProducts([]);
            setProductsError(
                "Could not load medicines for the selected branch.",
            );
        } finally {
            setProductsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open || !canAssignBranch) {
            return;
        }

        const selectedBranchId = Number(data.branch_id);

        if (!selectedBranchId) {
            setProducts([]);
            return;
        }

        loadProductsForBranch(selectedBranchId);
    }, [open, canAssignBranch, data.branch_id, loadProductsForBranch]);

    const productMap = useMemo(() => {
        return Object.fromEntries(
            (products ?? []).map((product) => [String(product.id), product]),
        );
    }, [products]);

    const selectedProduct = draft.pd_id
        ? (productMap[draft.pd_id] ?? null)
        : null;

    const availableLots = (selectedProduct?.batches ?? []).filter(
        (lot) =>
            (lot.status ?? "Active") === "Active" && Number(lot.quantity) > 0,
    );

    const selectedLot = draft.products_qty_id
        ? (availableLots.find(
              (lot) => String(lot.id) === String(draft.products_qty_id),
          ) ?? null)
        : null;

    // Informational only now — Box stays selectable either way, since
    // pieces-per-box is entered per transaction rather than relying solely
    // on the product's master data.
    const boxesUnavailable =
        selectedProduct !== null && !hasValidPackSize(selectedProduct);

    const lotFor = (productId, batchId) => {
        const lots = productMap[productId]?.batches ?? [];

        return lots.find((lot) => String(lot.id) === String(batchId)) ?? null;
    };

    /** Max whole units of `unitType` this lot's pieces will cover, using the
     * typed pieces-per-box for Box lines rather than the product's stored
     * pack size. */
    const ceilingFor = (productId, batchId, unitType, piecesPerBoxValue) => {
        const lot = lotFor(productId, batchId);

        if (!lot) {
            return 0;
        }

        const availablePieces = Math.max(toWholeNumber(lot.quantity), 0);

        if (!isBoxUnit(unitType)) {
            return availablePieces;
        }

        const packSize = toWholeNumber(piecesPerBoxValue);

        return packSize >= 1 ? Math.floor(availablePieces / packSize) : 0;
    };

    const effectivePiecesPerBox = isBoxUnit(draft.unit_type)
        ? toWholeNumber(draft.pieces_per_box)
        : 1;

    const maxQuantity = selectedLot
        ? ceilingFor(
              draft.pd_id,
              draft.products_qty_id,
              draft.unit_type,
              draft.pieces_per_box,
          )
        : 0;

    const piecesPreview = selectedProduct
        ? isBoxUnit(draft.unit_type)
            ? (Number(draft.quantity_deducted) || 0) * effectivePiecesPerBox
            : Number(draft.quantity_deducted) || 0
        : 0;

    const piecesLabel = selectedProduct
        ? isBoxUnit(draft.unit_type)
            ? effectivePiecesPerBox >= 1
                ? `${piecesPreview} ${piecesPreview === 1 ? "piece" : "pieces"} (${effectivePiecesPerBox} pcs/box)`
                : "Enter pcs per box to see how many pieces this will deduct"
            : `${piecesPreview} ${piecesPreview === 1 ? "piece" : "pieces"}`
        : "";

    const openModal = () => {
        clearErrors();
        setDraft(emptyDraft());
        setProductsError(null);
        setProducts(initialProducts ?? []);
        setData(emptyForm(defaultBranchId));
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setDraft(emptyDraft());
        setProducts(initialProducts ?? []);
        setProductsError(null);
        reset();
        clearErrors();
    };

    const handleBranchChange = (value) => {
        setData("branch_id", value);
        setDraft(emptyDraft());
        setProductsError(null);
    };

    const updateDraft = (field, value) => {
        setDraft((current) => {
            const next = { ...current, [field]: value };

            if (field === "pd_id") {
                next.products_qty_id = "";
                next.quantity_deducted = 1;
                next.unit_type = UNIT_PIECE;
                next.pieces_per_box = "";

                return next;
            }

            if (field === "products_qty_id") {
                next.quantity_deducted = clampQuantity(
                    current.quantity_deducted,
                    {
                        max: ceilingFor(
                            current.pd_id,
                            value,
                            current.unit_type,
                            current.pieces_per_box,
                        ),
                    },
                );

                return next;
            }

            if (field === "unit_type") {
                if (isBoxUnit(value)) {
                    // Pre-fill from the product's pack size the first time
                    // Box is chosen for this row; leave typed values alone.
                    if (!current.pieces_per_box) {
                        const product = current.pd_id
                            ? (productMap[current.pd_id] ?? null)
                            : null;
                        const defaultPack = product ? getPackSize(product) : 0;
                        next.pieces_per_box =
                            defaultPack >= 1 ? String(defaultPack) : "";
                    }
                } else {
                    next.pieces_per_box = "";
                }

                next.quantity_deducted = clampQuantity(
                    current.quantity_deducted,
                    {
                        max: ceilingFor(
                            current.pd_id,
                            current.products_qty_id,
                            value,
                            next.pieces_per_box,
                        ),
                    },
                );

                return next;
            }

            if (field === "pieces_per_box") {
                // The box ceiling depends on this value, so re-clamp the
                // quantity whenever it changes.
                next.quantity_deducted = clampQuantity(
                    current.quantity_deducted,
                    {
                        max: ceilingFor(
                            current.pd_id,
                            current.products_qty_id,
                            current.unit_type,
                            value,
                        ),
                    },
                );

                return next;
            }

            if (field === "quantity_deducted") {
                if (value === "") {
                    next.quantity_deducted = "";

                    return next;
                }

                const max = ceilingFor(
                    current.pd_id,
                    current.products_qty_id,
                    current.unit_type,
                    current.pieces_per_box,
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
                    current.pieces_per_box,
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
                        current.pieces_per_box,
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
        (!isBoxUnit(draft.unit_type) || effectivePiecesPerBox >= 1);

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
                pieces_per_box: isBoxUnit(draft.unit_type)
                    ? effectivePiecesPerBox
                    : null,
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
        products,
        productsLoading,
        productsError,
        canAssignBranch,
        branches,
        handleBranchChange,
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
        clearErrors,
    };
}
