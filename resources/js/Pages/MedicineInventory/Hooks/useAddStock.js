import { useState, useEffect, useMemo } from "react";
import { useForm } from "@inertiajs/react";

export default function useAddStock(medicine, branches, userBranchId) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        product_id: "",
        boxes_received: 1,
        branch_id: userBranchId ? String(userBranchId) : "",
        lot_number: "",
        expiry: "",
    });

    useEffect(() => {
        if (!medicine || !open) return;

        setData({
            product_id: String(medicine.id),
            boxes_received: 1,
            branch_id: userBranchId ? String(userBranchId) : "",
            lot_number: "",
            expiry: "",
        });
    }, [medicine, open, userBranchId]);

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

        post(route("medicine-inventory.store-stock"), {
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
        branches,
    };
}
