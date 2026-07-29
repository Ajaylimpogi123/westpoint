import { useMemo, useState } from "react";
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

const emptyDraft = () => ({
    pd_id: "",
    batch_number: "",
    expiry_date: "",
    quantity_received: 1,
    shelf_number: "",
    unit_type: UNIT_PIECE,
});

const emptyForm = (branchId) => ({
    idempotency_key: newIdempotencyKey(),
    supplier_name: "",
    delivery_date: new Date().toISOString().slice(0, 10),
    branch_id: branchId ? String(branchId) : "",
    received_by: "",
    remarks: "",
    items: [],
});

export default function useStockIn({ branchId, products }) {
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

    const boxesUnavailable =
        selectedProduct !== null && !hasValidPackSize(selectedProduct);

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

            // Lot number, expiry, and quantity belong to the medicine that was
            // selected when they were typed. Carrying them onto a different
            // medicine is how a batch ends up labelled with another product's
            // lot number.
            if (field === "pd_id" && value !== current.pd_id) {
                next.batch_number = "";
                next.expiry_date = "";
                next.quantity_received = 1;
                next.shelf_number = "";
                next.unit_type = UNIT_PIECE;

                return next;
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

    const canAddToBasket =
        Boolean(draft.pd_id) &&
        draft.batch_number.trim() !== "" &&
        Boolean(draft.expiry_date) &&
        Number(draft.quantity_received) >= 1 &&
        !(isBoxUnit(draft.unit_type) && boxesUnavailable);

    const addItemToBasket = () => {
        if (!canAddToBasket) {
            return;
        }

        setData("items", [
            ...data.items,
            {
                pd_id: draft.pd_id,
                batch_number: draft.batch_number.trim(),
                expiry_date: draft.expiry_date,
                quantity_received: Number(draft.quantity_received),
                shelf_number: draft.shelf_number.trim(),
                unit_type: draft.unit_type,
                // Display only. The server recomputes from the product's
                // current pack_size so a concurrent edit cannot make the
                // booked quantity differ from the validated one.
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

        post(route("stock-in.store"), {
            onSuccess: () => closeModal(),
            preserveScroll: true,
            only: ["stockIns", "medicines", "products", "movementLogs"],
        });
    };

    return {
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        normalizeQuantity,
        selectedProduct,
        boxesUnavailable,
        canAddToBasket,
        productMap,
        products: products ?? [],
        addItemToBasket,
        removeItemFromBasket,
        piecesPreview,
        piecesLabel,
        errors,
        processing,
        handleSubmit,
    };
}
