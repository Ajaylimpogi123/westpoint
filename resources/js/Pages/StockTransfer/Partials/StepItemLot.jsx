import { useMemo } from "react";
import LotPickerList from "./LotPickerList";
import { useLotSelector } from "../Hooks/useLotSelector";
import { describeProduct, piecesLabel } from "../lib/TransferHelpers";

/**
 * StepItemLot — Wizard Step 1
 * Pick the source branch (admins), a medicine, a lot (FEFO) and a quantity in
 * pieces, then add it. Multiple items can be added before clicking Next.
 */
export default function StepItemLot({
    products,
    productsLoading,
    productsError,
    onRetryProducts,
    branches,
    sourceBranchId,
    sourceBranchName,
    canChooseSource,
    onChangeSource,
    selectedItems,
    onAddItem,
    onRemoveItem,
    onNext,
    error,
}) {
    const {
        selectedProduct,
        selectProduct,
        selectedLot,
        selectLot,
        qty,
        updateQty,
        qtyError,
        isValid,
        reset,
    } = useLotSelector();

    // Lot quantities minus what is already in the list, so the same lot
    // can't be requested twice beyond what it holds.
    const availableProducts = useMemo(() => {
        const reserved = {};
        selectedItems.forEach((item) => {
            reserved[item.products_qty_id] =
                (reserved[item.products_qty_id] ?? 0) + item.quantity_requested;
        });

        return products.map((product) => ({
            ...product,
            products_qty: (product.products_qty ?? []).map((lot) => ({
                ...lot,
                quantity: Math.max(0, lot.quantity - (reserved[lot.id] ?? 0)),
            })),
        }));
    }, [products, selectedItems]);

    const handleAdd = () => {
        if (!isValid) return;
        onAddItem(selectedProduct, selectedLot, qty);
        reset();
    };

    const qtyNumber = Number(qty);
    const packSize = Number(selectedProduct?.pack_size) || 0;

    return (
        <div className="space-y-5">
            {/* Source branch */}
            <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Transfer from
                </label>
                {canChooseSource ? (
                    <select
                        value={sourceBranchId ?? ""}
                        onChange={(e) => {
                            reset();
                            onChangeSource(e.target.value);
                        }}
                        className="w-full sm:w-1/2 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="w-full sm:w-1/2 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-600">
                        {sourceBranchName || "Your branch"}
                    </div>
                )}
            </div>

            {/* Product select + qty */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Item to transfer
                    </label>
                    <select
                        value={selectedProduct?.id ?? ""}
                        disabled={productsLoading}
                        onChange={(e) => {
                            const p = availableProducts.find(
                                (p) => p.id === parseInt(e.target.value, 10),
                            );
                            selectProduct(p || null);
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50"
                    >
                        <option value="">
                            {productsLoading
                                ? "Loading medicines…"
                                : "— Select a medicine —"}
                        </option>
                        {availableProducts.map((p) => {
                            const hasStock = p.products_qty.some(
                                (lot) => lot.quantity > 0,
                            );

                            return (
                                <option
                                    key={p.id}
                                    value={p.id}
                                    disabled={!hasStock}
                                >
                                    {describeProduct(p)}
                                    {!hasStock && " (no available stock)"}
                                </option>
                            );
                        })}
                    </select>
                    {productsError && (
                        <p className="text-xs text-red-500 mt-1">
                            {productsError}{" "}
                            <button
                                type="button"
                                onClick={onRetryProducts}
                                className="underline"
                            >
                                Retry
                            </button>
                        </p>
                    )}
                    {!productsLoading &&
                        !productsError &&
                        products.length === 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                                This branch has no medicines to transfer.
                            </p>
                        )}
                </div>

                <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Quantity (pieces)
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={qty}
                        onChange={(e) => updateQty(e.target.value)}
                        placeholder="e.g. 50"
                        disabled={!selectedLot}
                        className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none
                            ${qtyError ? "border-red-400" : "border-gray-300"}`}
                    />
                    {qtyError ? (
                        <p className="text-xs text-red-500 mt-1">{qtyError}</p>
                    ) : (
                        packSize > 1 &&
                        qtyNumber > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                                = {piecesLabel(qtyNumber, packSize)}
                            </p>
                        )
                    )}
                </div>
            </div>

            {/* Lot picker */}
            {selectedProduct && (
                <LotPickerList
                    lots={selectedProduct.products_qty ?? []}
                    selectedLot={selectedLot}
                    onSelect={selectLot}
                />
            )}

            {/* Add to list */}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!isValid}
                    className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700
                        disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    + Add to list
                </button>
            </div>

            {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </p>
            )}

            {/* Items added so far */}
            {selectedItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs uppercase tracking-wide text-gray-500 font-medium">
                        Items to transfer ({selectedItems.length})
                    </div>
                    <div className="divide-y divide-gray-100">
                        {selectedItems.map((item) => (
                            <div
                                key={item._key}
                                className="flex items-center justify-between px-4 py-3"
                            >
                                <div>
                                    <div className="text-sm font-medium text-gray-800">
                                        {item._product_name}
                                        {item._brand && (
                                            <span className="text-gray-400 font-normal ml-1">
                                                · {item._brand}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                                        Lot {item.lot_number ?? "—"} ·{" "}
                                        {piecesLabel(
                                            item.quantity_requested,
                                            item._pack_size,
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemoveItem(item._key)}
                                    className="text-xs text-red-500 hover:text-red-700 ml-4"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Next */}
            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    onClick={onNext}
                    disabled={selectedItems.length === 0}
                    className="text-sm px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700
                        disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
