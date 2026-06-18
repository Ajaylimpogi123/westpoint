import { useState, useEffect } from "react";
import { useForm } from "@inertiajs/react";

export default function useEditBranch(branch) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset } = useForm({
        branch_name: "",
    });

    useEffect(() => {
        if (!branch || !open) return;

        setData({
            branch_name: branch.branch_name || "",
        });
    }, [branch, open]);

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        patch(route("branch-management.update", branch.id), {
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
