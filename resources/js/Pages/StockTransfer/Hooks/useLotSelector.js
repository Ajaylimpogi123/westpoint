import { useState } from "react";
import { getDaysUntilExpiry } from "../lib/TransferHelpers";

/**
 * useLotSelector
 * Handles product selection and FEFO-sorted lot picking for Step 1 of the wizard.
 * Lot `quantity` here is what is still free after lines already in the list.
 */
export function useLotSelector() {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedLot, setSelectedLot] = useState(null);
    const [qty, setQty] = useState("");
    const [qtyError, setQtyError] = useState("");

    const selectProduct = (product) => {
        setSelectedProduct(product);
        setQtyError("");
        setQty("");

        // Auto-select first valid (non-expired, not fully used) lot —
        // products_qty is already sorted by expiry ASC from the controller (FEFO)
        const firstValid = product?.products_qty?.find((lot) => {
            const days = getDaysUntilExpiry(lot.expiry);
            return (days === null || days >= 0) && lot.quantity > 0;
        });
        setSelectedLot(firstValid || null);
    };

    const selectLot = (lot) => {
        const days = getDaysUntilExpiry(lot.expiry);
        if (days !== null && days < 0) return; // block expired lots
        if (lot.quantity <= 0) return; // already fully in the list
        setSelectedLot(lot);
        setQty("");
        setQtyError("");
    };

    const updateQty = (value) => {
        setQty(value);
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            setQtyError("Enter a whole number of pieces.");
        } else if (parsed > (selectedLot?.quantity ?? 0)) {
            setQtyError(`Max available: ${selectedLot?.quantity ?? 0} pcs.`);
        } else {
            setQtyError("");
        }
    };

    const parsedQty = Number(qty);
    const isValid =
        !!selectedProduct &&
        !!selectedLot &&
        Number.isInteger(parsedQty) &&
        parsedQty > 0 &&
        parsedQty <= (selectedLot?.quantity ?? 0) &&
        !qtyError;

    const reset = () => {
        setSelectedProduct(null);
        setSelectedLot(null);
        setQty("");
        setQtyError("");
    };

    return {
        selectedProduct,
        selectProduct,
        selectedLot,
        selectLot,
        qty,
        updateQty,
        qtyError,
        isValid,
        reset,
    };
}
