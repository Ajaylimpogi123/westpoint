import { useForm } from "@inertiajs/react";

export default function useAddCustomer(defaultBranchId = "") {
    const { data, setData, post, errors, processing, reset } = useForm({
        first_name: "",
        last_name: "",
        phone_number: "",
        email: "",
        address: "",
        customer_type: "Regular",
        branch_id: defaultBranchId ? String(defaultBranchId) : "",
    });

    const submit = (e) => {
        e.preventDefault();

        post(route("customer-management.store"), {
            onSuccess: () => {
                reset(
                    "first_name",
                    "last_name",
                    "phone_number",
                    "email",
                    "address",
                    "customer_type",
                );

                if (defaultBranchId) {
                    setData("branch_id", String(defaultBranchId));
                }
            },
            preserveScroll: true,
        });
    };

    return { data, setData, errors, processing, submit };
}
