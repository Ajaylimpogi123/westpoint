import { useState, useEffect } from "react";
import { useForm } from "@inertiajs/react";

export default function useEditMedicine(medicine) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset } = useForm({
        med_name: "",
        dose: "",
        form: "",
        pack_size: 1,
        brand_name: "",
        retail_price: "",
        stock_threshold: 10,
        wholesale_price: "",
    });

    useEffect(() => {
        if (!medicine || !open) return;

        setData({
            med_name: medicine.med_name || "",
            dose: medicine.dose || "",
            form: medicine.form || "",
            pack_size: medicine.pack_size || 1,
            brand_name: medicine.brand_name || "",
            retail_price: medicine.retail_price || "",
            stock_threshold: medicine.stock_threshold ?? 10,
            wholesale_price: medicine.wholesale_price || "",
        });
    }, [medicine, open]);

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        patch(route("medicine-inventory.update", medicine.id), {
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
    };
}
