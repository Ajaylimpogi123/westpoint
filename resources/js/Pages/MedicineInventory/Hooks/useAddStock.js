import { useState, useEffect, useMemo } from "react";
import { useForm } from "@inertiajs/react";
import {
    UNIT_BOX,
    UNIT_PIECE,
    UNIT_TYPES,
    clampQuantity,
    describePieces,
    hasValidPackSize,
    isBoxUnit,
} from "@/lib/units";

export default function useAddStock(medicine) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        product_id: "",
        boxes_received: 1,
        unit_type: UNIT_BOX,
        lot_number: "",
        expiry: "",
        shelf_number: "",
    });

    const boxesUnavailable = medicine ? !hasValidPackSize(medicine) : false;

    useEffect(() => {
        if (!medicine || !open) return;

        setData({
            product_id: String(medicine.id),
            boxes_received: 1,
            unit_type: hasValidPackSize(medicine) ? UNIT_BOX : UNIT_PIECE,
            lot_number: "",
            expiry: "",
            shelf_number: "",
        });
    }, [medicine, open]);

    const piecesLabel = useMemo(
        () =>
            medicine
                ? describePieces(medicine, data.boxes_received, data.unit_type)
                : "",
        [medicine, data.boxes_received, data.unit_type],
    );

    const normalizeQuantity = () =>
        setData("boxes_received", clampQuantity(data.boxes_received));

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (processing || (isBoxUnit(data.unit_type) && boxesUnavailable)) {
            return;
        }

        post(route("medicine-inventory.store-stock"), {
            onSuccess: () => {
                closeModal();
            },
            preserveScroll: true,
        });
    };

    return {
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        normalizeQuantity,
        piecesLabel,
        boxesUnavailable,
    };
}
