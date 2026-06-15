import { useState } from "react";
import { useForm } from "@inertiajs/react";

export default function useAddCategory() {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        cat_name: "",
        cat_description: "",
        cat_image: null,
    });

    const openModal = () => setOpen(true);
    const closeModal = () => setOpen(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setData("cat_image", file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("category.store"), {
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
        handleFileChange,
    };
}
