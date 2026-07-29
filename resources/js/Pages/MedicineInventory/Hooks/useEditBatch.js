import { useState, useEffect, useMemo } from "react";
import { useForm } from "@inertiajs/react";
import { getPackSize, toWholeNumber } from "@/lib/units";

export default function useEditBatch(batch, medicine) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset } = useForm({
        lot_number: "",
        expiry: "",
        quantity_in_pieces: 0,
        shelf_number: "",
        adjustment_reason: "",
    });

    // The stored quantity is loaded verbatim. It used to be divided by
    // pack_size and rounded for display, which meant a batch holding a
    // partial box could not be represented — and saving wrote the rounded
    // value straight back, creating or destroying stock.
    useEffect(() => {
        if (!batch || !open) return;

        setData({
            lot_number: batch.lot_number || "",
            expiry: batch.expiry ? batch.expiry.slice(0, 10) : "",
            quantity_in_pieces: Number(batch.quantity) || 0,
            shelf_number: batch.shelf_number || "",
            adjustment_reason: "",
        });
    }, [batch, open]);

    const packSize = getPackSize(medicine);

    const breakdown = useMemo(() => {
        const pieces = Math.max(toWholeNumber(data.quantity_in_pieces), 0);

        if (packSize < 1) {
            return `${pieces} piece${pieces === 1 ? "" : "s"}`;
        }

        const boxes = Math.floor(pieces / packSize);
        const loose = pieces % packSize;

        if (boxes === 0) {
            return `${pieces} piece${pieces === 1 ? "" : "s"}`;
        }

        return loose === 0
            ? `${pieces} pieces (${boxes} box${boxes === 1 ? "" : "es"})`
            : `${pieces} pieces (${boxes} box${boxes === 1 ? "" : "es"} + ${loose} loose)`;
    }, [data.quantity_in_pieces, packSize]);

    const originalQuantity = Number(batch?.quantity) || 0;
    const delta = toWholeNumber(data.quantity_in_pieces) - originalQuantity;

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (processing) {
            return;
        }

        patch(route("medicine-inventory.update-batch", batch.id), {
            onSuccess: () => {
                closeModal();
            },
            preserveScroll: true,
        });
    };

    return {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        breakdown,
        delta,
        packSize,
    };
}
