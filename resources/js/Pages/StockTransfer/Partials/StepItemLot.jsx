import LotPickerList from "./LotPickerList";
import { useLotSelector } from "../Hooks/useLotSelector";

/**
 * StepItemLot — Wizard Step 1
 * Secretary picks a medicine, selects a lot (FEFO), enters quantity, then adds it.
 * Multiple items can be added before clicking Next.
 *
 * Props: products[], selectedItems[], onAddItem(product,lot,qty), onRemoveItem(key), onNext()
 */
export default function StepItemLot({
    products,
    selectedItems,
    onAddItem,
    onRemoveItem,
    onNext,
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

    const handleAdd = () => {
        if (!isValid) return;
        onAddItem(selectedProduct, selectedLot, qty);
        reset();
    };

    return (
        <div className="space-y-5">
            {/* Product select + qty */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Item to transfer
                    </label>
                    <select
                        value={selectedProduct?.id ?? ""}
                        onChange={(e) => {
                            const p = products.find(
                                (p) => p.id === parseInt(e.target.value),
                            );
                            selectProduct(p || null);
                        }}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">— Select a medicine —</option>
                        {products.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.med_name} {p.dose} — {p.brand_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Quantity
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => updateQty(e.target.value)}
                        placeholder="e.g. 50"
                        disabled={!selectedProduct}
                        className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none
                            ${qtyError ? "border-red-400" : "border-gray-300"}`}
                    />
                    {qtyError && (
                        <p className="text-xs text-red-500 mt-1">{qtyError}</p>
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
                                        <span className="text-gray-400 font-normal ml-1">
                                            · {item._brand}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">
                                        Lot {item.lot_number} ·{" "}
                                        {item.quantity_requested} units
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
