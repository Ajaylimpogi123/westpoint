import { useState } from "react";
import { useForm } from "@inertiajs/react";

/**
 * useStockTransferForm
 * Drives the 3-step wizard: item+lot → route+reason → review+submit
 */
export function useStockTransferForm({ userBranch }) {
    const [step, setStep] = useState(1);
    const [selectedItems, setSelectedItems] = useState([]); // rich display objects

    const { data, setData, post, processing, errors, reset, clearErrors } =
        useForm({
            from_branch_id: userBranch,
            to_branch_id: "",
            priority: "normal",
            reason: "",
            needed_by: "",
            transfer_date: new Date().toISOString().split("T")[0],
            items: [],
        });

    // ── Items management ──────────────────────────────────

    const addItem = (product, lot, qty) => {
        const displayItem = {
            _key: Date.now(), // local key for list rendering
            product_id: product.id,
            products_qty_id: lot.id,
            lot_number: lot.lot_number,
            expiry: lot.expiry,
            quantity_requested: parseInt(qty, 10),
            _product_name: `${product.med_name} ${product.dose}`,
            _brand: product.brand_name,
            _lot_available: lot.quantity,
        };

        const nextItems = [...selectedItems, displayItem];
        setSelectedItems(nextItems);
        setData("items", nextItems.map(stripDisplayFields));
    };

    const removeItem = (key) => {
        const nextItems = selectedItems.filter((i) => i._key !== key);
        setSelectedItems(nextItems);
        setData("items", nextItems.map(stripDisplayFields));
    };

    // ── Wizard navigation ─────────────────────────────────

    const goNext = () => setStep((s) => Math.min(s + 1, 3));
    const goBack = () => setStep((s) => Math.max(s - 1, 1));
    const goStep = (n) => setStep(n);

    // ── Submission ────────────────────────────────────────

    const submit = () => {
        post(route("stock-transfers.store"), {
            onSuccess: () => {
                reset();
                setStep(1);
                setSelectedItems([]);
            },
        });
    };

    return {
        // wizard
        step,
        goNext,
        goBack,
        goStep,
        // form data
        data,
        setData,
        errors,
        processing,
        clearErrors,
        // items
        selectedItems,
        addItem,
        removeItem,
        // submit
        submit,
    };
}

// ─────────────────────────────────────────────────────────
// Internal: strip _prefixed display-only fields before sending
// ─────────────────────────────────────────────────────────
function stripDisplayFields(item) {
    return {
        product_id: item.product_id,
        products_qty_id: item.products_qty_id,
        lot_number: item.lot_number,
        expiry: item.expiry,
        quantity_requested: item.quantity_requested,
    };
}
