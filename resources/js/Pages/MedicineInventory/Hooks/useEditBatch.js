import { useState, useEffect, useMemo } from "react";
import { useForm } from "@inertiajs/react";

export default function useEditBatch(batch, medicine) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset } = useForm({
        lot_number: "",
        expiry: "",
        boxes_received: 0,
        shelf_number: "",
    });

    useEffect(() => {
        if (!batch || !medicine || !open) return;

        const packSize = medicine.pack_size || 1;
        const boxes =
            packSize > 0 ? Math.round(batch.quantity / packSize) : 0;

        setData({
            lot_number: batch.lot_number || "",
            expiry: batch.expiry ? batch.expiry.slice(0, 10) : "",
            boxes_received: boxes,
            shelf_number: batch.shelf_number || "",
        });
    }, [batch, medicine, open]);

    const piecesPreview = useMemo(() => {
        const boxes = Number(data.boxes_received) || 0;
        const packSize = medicine?.pack_size || 1;
        return boxes * packSize;
    }, [data.boxes_received, medicine?.pack_size]);

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

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
        piecesPreview,
    };
}
