import { useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";

const emptyDraft = () => ({
    pd_id: "",
    batch_number: "",
    expiry_date: "",
    quantity_received: 1,
});

export default function useStockIn({ branchId, products }) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);

    const { data, setData, post, errors, processing, reset, clearErrors } =
        useForm({
            supplier_name: "",
            delivery_date: new Date().toISOString().slice(0, 10),
            branch_id: branchId ? String(branchId) : "",
            received_by: "",
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

    const openModal = () => {
        clearErrors();
        setDraft(emptyDraft());
        setData({
            supplier_name: "",
            delivery_date: new Date().toISOString().slice(0, 10),
            branch_id: branchId ? String(branchId) : "",
            received_by: "",
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
        setDraft((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const addItemToBasket = () => {
        if (
            !draft.pd_id ||
            !draft.batch_number.trim() ||
            !draft.expiry_date ||
            Number(draft.quantity_received) < 1
        ) {
            return;
        }

        setData("items", [
            ...data.items,
            {
                pd_id: draft.pd_id,
                batch_number: draft.batch_number.trim(),
                expiry_date: draft.expiry_date,
                quantity_received: Number(draft.quantity_received),
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

        post(route("stock-in.store"), {
            onSuccess: () => closeModal(),
            preserveScroll: true,
            only: ["stockIns", "medicines", "movementLogs"],
        });
    };

    return {
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        selectedProduct,
        productMap,
        products: products ?? [],
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
    };
}
