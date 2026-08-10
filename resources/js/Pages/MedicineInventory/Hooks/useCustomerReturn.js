import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";
import {
    UNIT_PIECE,
    UNIT_TYPES,
    clampQuantity,
    describePieces,
    hasValidPackSize,
    isBoxUnit,
    toPieces,
} from "@/lib/units";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
    BATCH_INTENT,
    batchToDraftFields,
    existingLotsForProduct,
    resolveBatchIntent,
} from "../lib/batchIntent";
import { fetchBranchProducts } from "../lib/inventoryMedicinesApi";
import { fetchBranchCustomers } from "../lib/customersApi";

const emptyDraft = () => ({
    pd_id: "",
    batch_number: "",
    expiry_date: "",
    quantity_received: 1,
    shelf_number: "",
    unit_type: UNIT_PIECE,
    confirm_duplicate_lot: false,
});

const emptyForm = (branchId) => ({
    idempotency_key: newIdempotencyKey(),
    customer_id: "",
    return_date: new Date().toISOString().slice(0, 10),
    branch_id: branchId ? String(branchId) : "",
    received_by: "",
    remarks: "",
    items: [],
});

export default function useCustomerReturn({
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

    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(false);
    const [customersError, setCustomersError] = useState(null);

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

    const loadCustomersForBranch = useCallback(async (targetBranchId) => {
        if (!targetBranchId) {
            setCustomers([]);
            return;
        }

        setCustomersLoading(true);
        setCustomersError(null);

        try {
            const response = await fetchBranchCustomers(targetBranchId);
            setCustomers(response.customers ?? []);
        } catch {
            setCustomers([]);
            setCustomersError(
                "Could not load customers for the selected branch.",
            );
        } finally {
            setCustomersLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        const selectedBranchId =
            Number(data.branch_id) || Number(defaultBranchId);

        if (!selectedBranchId) {
            setProducts([]);
            setCustomers([]);
            return;
        }

        if (canAssignBranch) {
            loadProductsForBranch(selectedBranchId);
        }
        loadCustomersForBranch(selectedBranchId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, canAssignBranch, data.branch_id]);

    const productMap = useMemo(() => {
        return Object.fromEntries(
            (products ?? []).map((product) => [String(product.id), product]),
        );
    }, [products]);

    const selectedProduct = draft.pd_id
        ? (productMap[draft.pd_id] ?? null)
        : null;

    const boxesUnavailable =
        selectedProduct !== null && !hasValidPackSize(selectedProduct);

    const batchIntent = useMemo(
        () => resolveBatchIntent(selectedProduct, draft),
        [
            selectedProduct,
            draft.batch_number,
            draft.expiry_date,
            draft.shelf_number,
        ],
    );

    const existingLots = useMemo(
        () => existingLotsForProduct(selectedProduct),
        [selectedProduct],
    );

    const openModal = () => {
        clearErrors();
        setDraft(emptyDraft());
        setProductsError(null);
        setProducts(initialProducts ?? []);
        setCustomersError(null);
        setData(emptyForm(defaultBranchId));
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setDraft(emptyDraft());
        setProducts(initialProducts ?? []);
        setProductsError(null);
        setCustomers([]);
        setCustomersError(null);
        reset();
        clearErrors();
    };

    const handleBranchChange = (value) => {
        setData("branch_id", value);
        setData("customer_id", "");
        setDraft(emptyDraft());
        setProductsError(null);
        setCustomersError(null);
    };

    // Called by NewCustomerModal's onCreated once a customer is saved —
    // adds them to the in-memory list and selects them, without a refetch.
    const addCustomerToList = (customer) => {
        setCustomers((current) => [...current, customer]);
        setData("customer_id", String(customer.customer_id));
    };

    const updateDraft = (field, value) => {
        setDraft((current) => {
            const next = { ...current, [field]: value };

            if (field === "pd_id" && value !== current.pd_id) {
                next.batch_number = "";
                next.expiry_date = "";
                next.quantity_received = 1;
                next.shelf_number = "";
                next.unit_type = UNIT_PIECE;
                next.confirm_duplicate_lot = false;

                return next;
            }

            if (
                field === "batch_number" ||
                field === "expiry_date" ||
                field === "shelf_number"
            ) {
                next.confirm_duplicate_lot = false;
            }

            if (field === "quantity_received") {
                if (value === "") {
                    next.quantity_received = "";
                    return next;
                }

                next.quantity_received = clampQuantity(value, {
                    min: 0,
                    fallback: current.quantity_received || 0,
                });
            }

            return next;
        });
    };

    const applyExistingLot = (batch) => {
        setDraft((current) => ({
            ...current,
            ...batchToDraftFields(batch),
            confirm_duplicate_lot: false,
        }));
    };

    const normalizeQuantity = () => {
        setDraft((current) => ({
            ...current,
            quantity_received: clampQuantity(current.quantity_received),
        }));
    };

    const piecesPreview = useMemo(
        () =>
            selectedProduct
                ? toPieces(
                      selectedProduct,
                      draft.quantity_received,
                      draft.unit_type,
                  )
                : 0,
        [selectedProduct, draft.quantity_received, draft.unit_type],
    );

    const piecesLabel = useMemo(
        () =>
            selectedProduct
                ? describePieces(
                      selectedProduct,
                      draft.quantity_received,
                      draft.unit_type,
                  )
                : "",
        [selectedProduct, draft.quantity_received, draft.unit_type],
    );

    const needsDuplicateConfirmation =
        batchIntent.mode === BATCH_INTENT.CONFLICT &&
        !draft.confirm_duplicate_lot;

    const canAddToBasket =
        Boolean(draft.pd_id) &&
        draft.batch_number.trim() !== "" &&
        Boolean(draft.expiry_date) &&
        Number(draft.quantity_received) >= 1 &&
        !(isBoxUnit(draft.unit_type) && boxesUnavailable) &&
        !needsDuplicateConfirmation;

    const addItemToBasket = () => {
        if (!canAddToBasket) return;

        setData("items", [
            ...data.items,
            {
                pd_id: draft.pd_id,
                batch_number: draft.batch_number.trim(),
                expiry_date: draft.expiry_date,
                quantity_received: Number(draft.quantity_received),
                shelf_number: draft.shelf_number.trim(),
                unit_type: draft.unit_type,
                confirm_duplicate_lot:
                    batchIntent.mode === BATCH_INTENT.CONFLICT,
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

        if (processing || data.items.length === 0) return;

        post(route("customer-return.store"), {
            onSuccess: () => closeModal(),
            preserveScroll: true,
            only: ["customerReturns", "medicines", "products", "movementLogs"],
        });
    };

    return {
        BATCH_INTENT,
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        setDraft,
        normalizeQuantity,
        selectedProduct,
        boxesUnavailable,
        batchIntent,
        existingLots,
        applyExistingLot,
        needsDuplicateConfirmation,
        canAddToBasket,
        productMap,
        products,
        productsLoading,
        productsError,
        customers,
        customersLoading,
        customersError,
        addCustomerToList,
        canAssignBranch,
        branches,
        handleBranchChange,
        addItemToBasket,
        removeItemFromBasket,
        piecesPreview,
        piecesLabel,
        errors,
        processing,
        handleSubmit,
    };
}
