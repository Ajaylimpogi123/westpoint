import { useState } from "react";
import { useForm } from "@inertiajs/react";

export default function useAddMedicine() {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        med_name: "",
        dose: "",
        form: "",
        pack_size: 1,
        brand_name: "",
        retail_price: "",
        wholesale_price: "",
    });

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("medicine-inventory.store"), {
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
