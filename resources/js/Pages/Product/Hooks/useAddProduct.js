import { useState } from "react";
import { useForm } from "@inertiajs/react";

export default function useAddProduct() {
    const [open, setOpen] = useState(false);

    const { data, setData, post, errors, processing, reset } = useForm({
        cat_id: "",
        pd_name: "",
        pd_description: "",
        pd_price: 0,
        pd_qty: 0,
        pd_cost: 0,
        pd_mqty: 0,
        pd_image: null,
    });

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setData("pd_image", file);
    };

    const handleCategoryChange = (value) => {
        setData("cat_id", value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("product.store"), {
            onSuccess: () => {
                closeModal();
            },
         
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
        handleCategoryChange,
    };
}
