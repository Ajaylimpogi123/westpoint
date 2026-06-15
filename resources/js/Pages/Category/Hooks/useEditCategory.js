import { useState, useEffect } from "react";
import { useForm } from "@inertiajs/react";

export default function useEditCategory(category) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset } = useForm({
        cat_name: "",
        cat_description: "",
        cat_image: null,
    });

    //  Sync form when category changes or modal opens
    useEffect(() => {
        if (!category || !open) return;

        setData({
            cat_name: category.cat_name || "",
            cat_description: category.cat_description || "",
            cat_image: null, // important: don't preload File
        });
    }, [category, open]);

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setData("cat_image", file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        patch(route("category.update", category.cat_id), {
            onSuccess: () => {
                closeModal();
            },
            forceFormData: true,
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
        handleFileChange,
    };
}
