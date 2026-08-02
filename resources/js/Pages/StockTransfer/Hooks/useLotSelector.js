import { useState } from "react";
import { getDaysUntilExpiry } from "../lib/TransferHelpers";

/**
 * useLotSelector
 * Handles product selection and FEFO-sorted lot picking for Step 1 of the wizard.
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

        // Auto-select first valid (non-expired) lot — products_qty is already
        // sorted by expiry ASC from the controller (FEFO)
        const firstValid = product?.products_qty?.find((lot) => {
            const days = getDaysUntilExpiry(lot.expiry);
            return days === null || days > 0;
        });
        setSelectedLot(firstValid || null);
    };

    const selectLot = (lot) => {
        const days = getDaysUntilExpiry(lot.expiry);
        if (days !== null && days <= 0) return; // block expired lots
        setSelectedLot(lot);
        setQty("");
        setQtyError("");
    };

    const updateQty = (value) => {
        setQty(value);
        const parsed = parseInt(value, 10);
        if (!parsed || parsed <= 0) {
            setQtyError("Enter a valid quantity.");
        } else if (parsed > (selectedLot?.quantity ?? 0)) {
            setQtyError(`Max available: ${selectedLot?.quantity ?? 0} units.`);
        } else {
            setQtyError("");
        }
    };

    const isValid =
        !!selectedProduct &&
        !!selectedLot &&
        parseInt(qty, 10) > 0 &&
        parseInt(qty, 10) <= (selectedLot?.quantity ?? 0) &&
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
