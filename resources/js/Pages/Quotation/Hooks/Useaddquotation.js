import { useForm } from "@inertiajs/react";
import { useMemo } from "react";
import {
    addItem,
    calculateTotal,
    createBlankItem,
    removeItem,
    updateItem,
} from "../lib/quotationItems";

export default function useAddQuotation() {
    const form = useForm({
        cust_id: "",
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
        form.setData({
            ...form.data,
            cust_id: customer.cust_id,
            // don't clobber an address the user already typed
            address: form.data.address || customer.address || "",
        });
    }

    function submit(e) {
        e.preventDefault();
        form.post(route("quotations.store"));
    }

    return {
        form,
        addItem: handleAddItem,
        removeItem: handleRemoveItem,
        updateItem: handleUpdateItem,
        total,
        selectCustomer,
        submit,
    };
}
