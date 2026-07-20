import { useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";

const TRANSACTION_SUBTYPES = ["Dispensed to patient", "Returned to supplier"];

const UNIT_TYPES = [
    { value: "piece", label: "Piece (retail price)" },
    { value: "box", label: "Box / Wholesale (wholesale price)" },
];

const emptyDraft = () => ({
    pd_id: "",
    lot_number: "",
    quantity_deducted: 1,
    unit_type: "piece",
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
            delivered_to: "",
            delivered_to_address: "",
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
            delivered_to: "",
            delivered_to_address: "",
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
                // Allow the field to be temporarily empty while the user is
                // clearing it to type a new value — don't force it back to
                // 1 on every keystroke. It gets normalized on blur and is
                // re-validated before it can be added to the basket.
                if (value === "") {
                    next.quantity_deducted = "";
                    return next;
                }

                const parsed = Number(value);
                if (Number.isNaN(parsed)) {
                    next.quantity_deducted = current.quantity_deducted;
                    return next;
                }

                const lots = productMap[current.pd_id]?.batches ?? [];
                const lot = lots.find(
                    (l) => l.lot_number === current.lot_number,
                );
                const max = lot ? Number(lot.quantity) : 1;

                // Clamp the upper bound live so it can never exceed available
                // stock, but allow 0 transiently so backspacing to a single
                // remaining digit doesn't get force-corrected mid-edit.
                next.quantity_deducted = Math.min(max, Math.max(0, parsed));
            }

            return next;
        });
    };

    const normalizeQuantity = () => {
        setDraft((current) => {
            const lots = productMap[current.pd_id]?.batches ?? [];
            const lot = lots.find((l) => l.lot_number === current.lot_number);
            const max = lot ? Number(lot.quantity) : 1;
            const parsed = Number(current.quantity_deducted);
            const normalized = Math.max(
                1,
                Math.min(max, Number.isNaN(parsed) ? 1 : parsed),
            );

            return { ...current, quantity_deducted: normalized };
        });
    };

    const updateQuantity = (delta) => {
        setDraft((current) => {
            const lots = productMap[current.pd_id]?.batches ?? [];
            const lot = lots.find((l) => l.lot_number === current.lot_number);
            const max = lot ? Number(lot.quantity) : 1;
            const base = Number(current.quantity_deducted) || 0;
            const next = Math.max(1, Math.min(max, base + delta));

            return { ...current, quantity_deducted: next };
        });
    };

    const addItemToBasket = () => {
        const quantity = Number(draft.quantity_deducted);

        if (
            !draft.pd_id ||
            !draft.lot_number ||
            !Number.isFinite(quantity) ||
            quantity < 1
        ) {
            return;
        }

        if (selectedLot && quantity > Number(selectedLot.quantity)) {
            return;
        }

        setData("items", [
            ...data.items,
            {
                pd_id: draft.pd_id,
                lot_number: draft.lot_number,
                quantity_deducted: quantity,
                unit_type: draft.unit_type,
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
