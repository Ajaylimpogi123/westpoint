import { useState, useEffect } from "react";
import { useForm } from "@inertiajs/react";
import { toast } from "sonner";
export default function useEditProduct(product) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        cat_id: 0,
        pd_name: "",
        pd_description: "",
        pd_price: "",
        pd_qty: 0,
        pd_cost: 0,
        pd_mqty: 0,
        pd_image: null,
    });

    // 🔁 Sync form when modal opens
    useEffect(() => {
        if (!product || !open) return;

        setData({
            cat_id: product.cat_id || 0,
            pd_name: product.pd_name || "",
            pd_description: product.pd_description || "",
            pd_price: product.pd_price || 0,
            pd_qty: product.pd_qty || 0,
            pd_cost: product.pd_cost || 0,
            pd_mqty: product.pd_mqty || 0,
            pd_image: null, // never preload File
        });
    }, [product, open]);

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setData("pd_image", file);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const toastId = toast.loading("Updating product...", {
            position: "top-center",
            duration: Infinity,
        });
        // console.log("Submitting with data:", data);
        post(route("product.update", product.pd_id), {
            onSuccess: () => {
                toast.dismiss(toastId);
                toast.success("Product updated successfully!", {
                    duration: 3000,
                    position: "top-center",
                });
                closeModal();
            },
            onError: (errors) => {
                toast.dismiss(toastId);
                const errorMessage =
                    Object.values(errors)[0] || "Failed to update product";
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
        handleFileChange,
    };
}
