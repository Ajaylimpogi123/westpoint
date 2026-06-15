import { useState } from "react";
import { useForm } from "@inertiajs/react";

export default function useAddTable() {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        t_number: "",
        t_description: "",
    });

    const openModal = () => setOpen(true);
    const closeModal = () => setOpen(false);

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("table.store"), {
            onSuccess: () => {
                closeModal();
                reset();
            },
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return {
        // modal
        open,
        openModal,
        closeModal,

        // form
        data,
        setData,
        errors,
        processing,

        // handlers
        handleSubmit,
    };
}
