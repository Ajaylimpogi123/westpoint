import { useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    addItem,
    calculateTotal,
    createBlankItem,
    removeItem,
    updateItem,
} from "../lib/quotationItems";

export default function useAddQuotation() {
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const form = useForm({
        customer_id: "",
        sid_no: "",
        qt_date: "",
        address: "",
        delivery_type: "pick-up",
        qt_remarks: "",
        checked_by: "",
        prepared_by: "",
        items: [createBlankItem()],
    });

    const handleAddItem = () => form.setData("items", addItem(form.data.items));
    const handleRemoveItem = (index) =>
        form.setData("items", removeItem(form.data.items, index));
    const handleUpdateItem = (index, field, value) =>
        form.setData("items", updateItem(form.data.items, index, field, value));

    const total = useMemo(
        () => calculateTotal(form.data.items),
        [form.data.items],
    );

    function selectCustomer(customer) {
        setSelectedCustomer(customer);
        form.setData({
            ...form.data,
            customer_id: customer.customer_id,
            address: form.data.address || customer.address || "",
        });
    }

    function clearCustomer() {
        setSelectedCustomer(null);
        form.setData("customer_id", "");
    }

    function submit(e) {
        e.preventDefault();
        form.post(route("quotations.store"));
    }

    return {
        form,
        selectedCustomer,
        addItem: handleAddItem,
        removeItem: handleRemoveItem,
        updateItem: handleUpdateItem,
        total,
        selectCustomer,
        clearCustomer,
        submit,
    };
}
