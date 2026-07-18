import { useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";

const UNIT_TYPES = [
    { value: "Piece", label: "Piece" },
    { value: "Box", label: "Box / Wholesale" },
];

const emptyDraft = () => ({
    pd_id: "",
    batch_number: "",
    expiry_date: "",
    quantity_received: 1,
    shelf_number: "",
    unit_type: "Piece",
    unit_price: "",
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
        setDraft((current) => {
            const next = {
                ...current,
                [field]: value,
            };

            if (field === "pd_id" || field === "unit_type") {
                const productId = field === "pd_id" ? value : current.pd_id;
                const unitType =
                    field === "unit_type" ? value : current.unit_type;
                const product = productId
                    ? productMap[productId] ?? null
                    : null;

                if (product) {
                    const suggestedPrice =
                        unitType === "Box"
                            ? product.wholesale_price
                            : product.retail_price;
                    next.unit_price =
                        suggestedPrice != null && suggestedPrice !== ""
                            ? String(suggestedPrice)
                            : "";
                }
            }

            return next;
        });
    };

    const addItemToBasket = () => {
        if (
            !draft.pd_id ||
            !draft.batch_number.trim() ||
            !draft.expiry_date ||
            Number(draft.quantity_received) < 1 ||
            draft.unit_price === "" ||
            Number(draft.unit_price) < 0
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
                shelf_number: draft.shelf_number.trim(),
                unit_type: draft.unit_type,
                unit_price: Number(draft.unit_price),
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
        UNIT_TYPES,
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
