import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";
import axios from "axios";
import {
    UNIT_PIECE,
    UNIT_TYPES,
    clampQuantity,
    getPackSize,
    hasValidPackSize,
    isBoxUnit,
    toWholeNumber,
} from "@/lib/units";
import { fetchBranchProducts } from "../lib/inventoryMedicinesApi";

const emptyDraft = () => ({
    pd_id: "",
    products_qty_id: "",
    quantity_deducted: 1,
    unit_type: UNIT_PIECE,
    pieces_per_box: "",
});

const emptyForm = () => ({
    patient_reference: "",
    issued_by: "",
    remarks: "",
    delivered_to: "",
    delivered_to_address: "",
    items: [],
});

export default function useStockOutEdit({ stockOutId, open }) {
    const [draft, setDraft] = useState(emptyDraft);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [transactionSubtype, setTransactionSubtype] = useState(null);

    const { data, setData, put, errors, processing, reset, clearErrors } =
        useForm(emptyForm());

    // Load the stock-out plus its branch's current products/lots whenever
    // the modal opens. Live lot quantities come from fetchBranchProducts,
    // the same source the create modal uses — nothing has been deducted
    // yet for an editable stock-out, so those quantities are already
    // accurate without any "reserved" adjustment.
    useEffect(() => {
        if (!open || !stockOutId) {
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setLoadError(null);
            clearErrors();

            try {
                const response = await axios.get(
                    route("stock-out.edit", stockOutId),
                );
                const { stock_out, items } = response.data;

                if (cancelled) return;

                setTransactionSubtype(stock_out.transaction_subtype);
                setData({
                    patient_reference: stock_out.patient_reference ?? "",
                    issued_by: stock_out.issued_by ?? "",
                    remarks: stock_out.remarks ?? "",
                    delivered_to: stock_out.delivered_to ?? "",
                    delivered_to_address: stock_out.delivered_to_address ?? "",
                    items: items.map((item) => ({
                        pd_id: String(item.pd_id),
                        products_qty_id: String(item.products_qty_id),
                        lot_number: item.lot_number,
                        quantity_deducted: item.quantity_deducted,
                        unit_type: item.unit_type,
                        pieces_per_box: item.pieces_per_box ?? null,
                        pieces_preview: item.pieces_deducted,
                    })),
                });

                setProductsLoading(true);
                try {
                    const branchProducts = await fetchBranchProducts(
                        stock_out.branch_id,
                    );
                    if (!cancelled) {
                        setProducts(branchProducts.products ?? []);
                    }
                } catch {
                    if (!cancelled) {
                        setProductsError(
                            "Could not load medicines for this branch.",
                        );
                    }
                } finally {
                    if (!cancelled) setProductsLoading(false);
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadError(
                        error?.response?.status === 403
                            ? "This stock-out can no longer be edited."
                            : "Failed to load this stock-out.",
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, stockOutId]);

    const resetLocal = () => {
        setDraft(emptyDraft());
        setProducts([]);
        setProductsError(null);
        setLoadError(null);
        reset();
        clearErrors();
    };

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

    const boxesUnavailable =
        selectedProduct !== null && !hasValidPackSize(selectedProduct);

    const lotFor = (productId, batchId) => {
        const lots = productMap[productId]?.batches ?? [];
        return lots.find((lot) => String(lot.id) === String(batchId)) ?? null;
    };

    const ceilingFor = (productId, batchId, unitType, piecesPerBoxValue) => {
        const lot = lotFor(productId, batchId);

        if (!lot) return 0;

        const availablePieces = Math.max(toWholeNumber(lot.quantity), 0);

        if (!isBoxUnit(unitType)) return availablePieces;

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
        if (!canAddToBasket) return;

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

    const handleSubmit = (event, { onSuccess } = {}) => {
        event.preventDefault();

        if (processing || data.items.length === 0) {
            return;
        }

        put(route("stock-out.update", stockOutId), {
            preserveScroll: true,
            only: ["stockOuts", "medicines", "products", "movementLogs"],
            onSuccess: () => {
                resetLocal();
                onSuccess?.();
            },
        });
    };

    return {
        UNIT_TYPES,
        loading,
        loadError,
        transactionSubtype,
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
        piecesLabel,
        boxesUnavailable,
        canAddToBasket,
        productMap,
        products,
        productsLoading,
        productsError,
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
        resetLocal,
    };
}
