import { useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    addItem,
    calculateTotal,
    removeItem,
    updateItem,
} from "../lib/quotationItems";

export default function useEditQuotation(quotation) {
    const [selectedCustomer, setSelectedCustomer] = useState(
        quotation.customer ?? null,
    );

    const form = useForm({
        customer_id: quotation.customer_id,
        sid_no: quotation.sid_no,
        qt_date: quotation.qt_date?.slice(0, 10) ?? "",
        address: quotation.address,
        delivery_type: quotation.delivery_type,
        qt_remarks: quotation.qt_remarks,
        checked_by: quotation.checked_by,
        prepared_by: quotation.prepared_by,
        items: quotation.items.map((item) => ({
            qt_qty: item.qt_qty,
            qt_unit: item.qt_unit ?? "",
            qt_description: item.qt_description,
            lot_number: item.lot_number ?? "",
            expiry_date: item.expiry_date ? item.expiry_date.slice(0, 10) : "",
            qt_unit_price: item.qt_unit_price,
        })),
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
        form.put(route("quotations.update", quotation.id));
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
