import { useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";

const TRANSACTION_SUBTYPES = [
    "Dispensed to patient",
    "Internal use / consumption",
    "Expired — write off",
    "Damaged / lost",
    "Returned to supplier",
];

const emptyDraft = () => ({
    pd_id: "",
    lot_number: "",
    quantity_deducted: 1,
});

export default function useStockOut({ branchId, products }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);

    const { data, setData, post, errors, processing, reset, clearErrors } =
        useForm({
            transaction_subtype: "",
            branch_id: branchId ? String(branchId) : "",
            patient_reference: "",
            issued_by: "",
            remarks: "",
            items: [],
        });

    const productMap = useMemo(() => {
        return Object.fromEntries(
            (products ?? []).map((product) => [String(product.id), product]),
        );
    }, [products]);

    const selectedProduct = draft.pd_id
        ? productMap[draft.pd_id] ?? null
        : null;

    const availableLots = selectedProduct?.batches ?? [];

    const selectedLot = draft.lot_number
        ? availableLots.find((lot) => lot.lot_number === draft.lot_number) ??
          null
        : null;

    const maxQuantity = selectedLot ? Number(selectedLot.quantity) : 1;

    const openModal = () => {
        clearErrors();
        setDraft(emptyDraft());
        setData({
            transaction_subtype: "",
            branch_id: branchId ? String(branchId) : "",
            patient_reference: "",
            issued_by: "",
            remarks: "",
            items: [],
        });
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
                next.lot_number = "";
                next.quantity_deducted = 1;
            }

            if (field === "lot_number") {
                const lots = productMap[current.pd_id]?.batches ?? [];
                const lot = lots.find((l) => l.lot_number === value);
                next.quantity_deducted = lot
                    ? Math.min(current.quantity_deducted, Number(lot.quantity))
                    : 1;
            }

            if (field === "quantity_deducted") {
                const lots = productMap[current.pd_id]?.batches ?? [];
                const lot = lots.find(
                    (l) => l.lot_number === current.lot_number,
                );
                const max = lot ? Number(lot.quantity) : 1;
                const parsed = Math.max(1, Number(value) || 1);
                next.quantity_deducted = Math.min(max, parsed);
            }

            return next;
        });
    };

    const updateQuantity = (delta) => {
        setDraft((current) => {
            const lots = productMap[current.pd_id]?.batches ?? [];
            const lot = lots.find((l) => l.lot_number === current.lot_number);
            const max = lot ? Number(lot.quantity) : 1;
            const next = Math.max(
                1,
                Math.min(max, Number(current.quantity_deducted) + delta),
            );

            return { ...current, quantity_deducted: next };
        });
    };

    const addItemToBasket = () => {
        if (
            !draft.pd_id ||
            !draft.lot_number ||
            Number(draft.quantity_deducted) < 1
        ) {
            return;
        }

        if (
            selectedLot &&
            Number(draft.quantity_deducted) > Number(selectedLot.quantity)
        ) {
            return;
        }

        setData("items", [
            ...data.items,
            {
                pd_id: draft.pd_id,
                lot_number: draft.lot_number,
                quantity_deducted: Number(draft.quantity_deducted),
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

        post(route("stock-out.store"), {
            onSuccess: () => closeModal(),
            preserveScroll: true,
            only: ["stockOuts", "medicines", "products"],
        });
    };

    return {
        TRANSACTION_SUBTYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        updateQuantity,
        selectedProduct,
        availableLots,
        selectedLot,
        maxQuantity,
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
