import { useState, useEffect } from "react";
import { useForm } from "@inertiajs/react";

export default function useEditCustomer(customer, canAssignBranch = false) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, errors, processing, reset, transform } =
        useForm({
        first_name: "",
        last_name: "",
        senior_id_number: "",
        pwd_id_number: "",
        email: "",
        address: "",
        customer_type: "Regular",
        status: "active",
        branch_id: "",
    });

    transform((formData) => {
        if (canAssignBranch) {
            return formData;
        }

        const { branch_id: _branchId, ...rest } = formData;
        return rest;
    });

    useEffect(() => {
        if (!customer || !open) return;

        setData({
            first_name: customer.first_name || "",
            last_name: customer.last_name || "",
            senior_id_number: customer.senior_id_number || "",
            pwd_id_number: customer.pwd_id_number || "",
            email: customer.email || "",
            address: customer.address || "",
            customer_type: customer.customer_type || "Regular",
            status: customer.status || "active",
            branch_id: customer.branch_id ? String(customer.branch_id) : "",
        });
    }, [customer, open]);

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        patch(route("customer-management.update", customer.customer_id), {
            onSuccess: () => {
                closeModal();
            },
            preserveScroll: true,
            only: ["customers", "flash"],
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
