import { useRef, useState } from "react";
import { useForm } from "@inertiajs/react";

// Local calendar date. toISOString() is UTC, which in the Philippines is the
// previous day until 8 AM.
const todayLocal = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * useStockTransferForm
 * Drives the 3-step wizard: item+lot → route+reason → review+submit
 *
 * Admins/superadmins (canChooseSource) can pick the source branch; its
 * medicines are then loaded from stock-transfers.source-products. Staff are
 * fixed to their own branch.
 */
export function useStockTransferForm({
    userBranch,
    products: initialProducts = [],
    canChooseSource = false,
}) {
    const [step, setStep] = useState(1);
    const [selectedItems, setSelectedItems] = useState([]); // rich display objects
    const [products, setProducts] = useState(initialProducts);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState(null);
    const latestBranchRequest = useRef(null);

    const { data, setData, post, processing, errors, reset, clearErrors } =
        useForm({
            from_branch_id: userBranch ?? "",
            to_branch_id: "",
            priority: "normal",
            reason: "",
            needed_by: "",
            transfer_date: todayLocal(),
            items: [],
        });

    // ── Source branch ─────────────────────────────────────

    const loadProducts = async (branchId) => {
        latestBranchRequest.current = branchId;
        setProducts([]);
        setProductsError(null);

        if (!branchId) return;

        setProductsLoading(true);
        try {
            const response = await fetch(
                route("stock-transfers.source-products", { branch_id: branchId }),
                {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                },
            );
            if (!response.ok) throw new Error();
            const json = await response.json();
            // Ignore a slow response for a branch that is no longer selected.
            if (latestBranchRequest.current === branchId) {
                setProducts(json.products ?? []);
            }
        } catch {
            if (latestBranchRequest.current === branchId) {
                setProductsError("Could not load medicines for this branch.");
            }
        } finally {
            if (latestBranchRequest.current === branchId) {
                setProductsLoading(false);
            }
        }
    };

    const changeSourceBranch = (branchId) => {
        if (!canChooseSource || String(branchId) === String(data.from_branch_id)) {
            return;
        }

        if (
            selectedItems.length > 0 &&
            !confirm(
                "Changing the source branch removes the items already added. Continue?",
            )
        ) {
            return;
        }

        setSelectedItems([]);
        setData((current) => ({
            ...current,
            from_branch_id: branchId,
            // The destination can't be the new source.
            to_branch_id:
                String(current.to_branch_id) === String(branchId)
                    ? ""
                    : current.to_branch_id,
            items: [],
        }));
        clearErrors();
        loadProducts(branchId);
    };

    // ── Items management ──────────────────────────────────

    const addItem = (product, lot, qty) => {
        const displayItem = {
            _key: `${Date.now()}-${Math.random()}`, // local key for list rendering
            product_id: product.id,
            products_qty_id: lot.id,
            lot_number: lot.lot_number,
            expiry: lot.expiry,
            quantity_requested: parseInt(qty, 10),
            _product_name: [product.med_name, product.dose]
                .filter(Boolean)
                .join(" "),
            _brand: product.brand_name,
            _pack_size: product.pack_size,
        };

        const nextItems = [...selectedItems, displayItem];
        setSelectedItems(nextItems);
        setData("items", nextItems.map(stripDisplayFields));
    };

    const removeItem = (key) => {
        const nextItems = selectedItems.filter((i) => i._key !== key);
        setSelectedItems(nextItems);
        setData("items", nextItems.map(stripDisplayFields));
        clearErrors("items");
    };

    // ── Wizard navigation ─────────────────────────────────

    const goNext = () => setStep((s) => Math.min(s + 1, 3));
    const goBack = () => setStep((s) => Math.max(s - 1, 1));
    const goStep = (n) => setStep(n);

    // ── Submission ────────────────────────────────────────

    const submit = () => {
        post(route("stock-transfers.store"), {
            preserveScroll: true,
            onSuccess: () => {
                // Keep the chosen source branch for the next request.
                reset("to_branch_id", "priority", "reason", "needed_by", "items");
                setData("transfer_date", todayLocal());
                setStep(1);
                setSelectedItems([]);
                // Lot quantities changed on the server; reload them.
                loadProducts(data.from_branch_id);
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
        // source branch + its medicines
        canChooseSource,
        changeSourceBranch,
        products,
        productsLoading,
        productsError,
        retryProducts: () => loadProducts(data.from_branch_id),
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
