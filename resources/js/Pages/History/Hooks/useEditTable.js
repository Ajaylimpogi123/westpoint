import { useState, useEffect } from "react";
import { useForm } from "@inertiajs/react";
import { toast } from "sonner";
import { CheckCircle, CircleCheck, Check } from "lucide-react";
export default function useEditTable(table) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset } = useForm({
        t_number: 0,
        t_description: "",
    });

    // Sync form when category changes or modal opens
    useEffect(() => {
        if (!table || !open) return;

        setData({
            t_number: Number(table.t_number) || 0,
            t_description: table.t_description || "",
        });
    }, [table, open]);

    const openModal = () => setOpen(true);

    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Show loading toast
        const toastId = toast.loading("Updating table...", {
            position: "top-center",
            duration: Infinity, // Keep until dismissed
        });

        patch(route("table.update", table.table_id), {
            onSuccess: () => {
                // Dismiss loading and show success
                toast.dismiss(toastId);
                toast.success("Table updated successfully!", {
                    duration: 3000,
                    position: "top-center",
                });
                closeModal();
            },
            onError: (errors) => {
                // Dismiss loading and show error
                toast.dismiss(toastId);

                // Get the first error message
                const errorMessage =
                    Object.values(errors)[0] || "Failed to update table";

                toast.error(errorMessage, {
                    duration: 4000,
                    position: "top-center",
                    style: {
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                    },
                });
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
