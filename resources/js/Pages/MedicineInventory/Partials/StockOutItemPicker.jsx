import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Minus, Plus, ShoppingBasket } from "lucide-react";
import { UNIT_TYPES, isBoxUnit, unitLabel } from "@/lib/units";
import MedicineSearchSelect from "./MedicineSearchSelect";
import StockOutProductPanel from "./StockOutProductPanel";
import { formatMoney } from "../lib/stockOutValidation";

const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Search a medicine, see its details and lots, choose unit / quantity and
 * add it to the basket. All state lives in useStockOutBasket (`basket`).
 */
export default function StockOutItemPicker({
    basket,
    products,
    productsLoading,
    productsError,
    onRetry,
    searchDisabled = false,
    emptyMessage,
    idPrefix = "",
    disabled = false,
}) {
    const {
        draft,
        updateDraft,
        updateQuantity,
        normalizeQuantity,
        selectedProduct,
        lotRows,
        selectedLot,
        selectedLotRow,
        maxQuantity,
        piecesLabel,
        draftUnitPrice,
        draftLineTotal,
        canAddToBasket,
        addBlockReason,
        addItemToBasket,
    } = basket;

    const id = (name) => `${idPrefix}${name}`;
    const lotPicked = Boolean(selectedLot);
    const box = isBoxUnit(draft.unit_type);

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor={id("product_select")}>Medicine</Label>
                <MedicineSearchSelect
                    id={id("product_select")}
                    products={products}
                    value={draft.pd_id}
                    onChange={(productId) => updateDraft("pd_id", productId)}
                    placeholder={
                        productsLoading
                            ? "Loading medicines..."
                            : "Search by name, brand, dose or form..."
                    }
                    disabled={
                        disabled ||
                        productsLoading ||
                        searchDisabled ||
                        products.length === 0
                    }
                    detailed
                />
                {productsError && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                        <span>{productsError}</span>
                        {onRetry && (
                            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                                Retry
                            </Button>
                        )}
                    </div>
                )}
                {!productsLoading && !productsError && emptyMessage && (
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                )}
            </div>

            <StockOutProductPanel
                product={selectedProduct}
                lotRows={lotRows}
                selectedLotId={draft.products_qty_id}
                onSelectLot={(lotId) => updateDraft("products_qty_id", lotId)}
                idPrefix={idPrefix}
                disabled={disabled}
            />

            {selectedProduct && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor={id("unit_type")}>Unit</Label>
                        <select
                            id={id("unit_type")}
                            value={draft.unit_type}
                            onChange={(event) => updateDraft("unit_type", event.target.value)}
                            disabled={disabled || !lotPicked}
                            className={selectClass}
                        >
                            {UNIT_TYPES.map((unitType) => (
                                <option key={unitType.value} value={unitType.value}>
                                    {unitType.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {box && (
                        <div className="grid gap-2">
                            <Label htmlFor={id("pieces_per_box")}>Pieces per box</Label>
                            <Input
                                id={id("pieces_per_box")}
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                value={draft.pieces_per_box}
                                onChange={(event) => updateDraft("pieces_per_box", event.target.value)}
                                placeholder="e.g. 24"
                                onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
                                disabled={disabled || !lotPicked}
                                aria-describedby={id("pieces_per_box_hint")}
                            />
                            <p id={id("pieces_per_box_hint")} className="text-xs text-muted-foreground">
                                Pre-filled from the medicine's pack size when set; this is what gets deducted.
                            </p>
                        </div>
                    )}

                    <div className="grid gap-2 sm:col-span-2">
                        <Label htmlFor={id("quantity_deducted")}>
                            Quantity ({unitLabel(draft.unit_type).toLowerCase()})
                        </Label>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => updateQuantity(-1)}
                                disabled={disabled || !lotPicked || Number(draft.quantity_deducted) <= 1}
                                aria-label="Decrease quantity"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                                id={id("quantity_deducted")}
                                type="number"
                                inputMode="numeric"
                                min="1"
                                step="1"
                                max={maxQuantity}
                                value={draft.quantity_deducted}
                                onChange={(event) => updateDraft("quantity_deducted", event.target.value)}
                                onBlur={normalizeQuantity}
                                onKeyDown={(event) => {
                                    // Enter adds the line rather than submitting the whole form.
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addItemToBasket();
                                    }
                                }}
                                disabled={disabled || !lotPicked}
                                className="text-center"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => updateQuantity(1)}
                                disabled={disabled || !lotPicked || Number(draft.quantity_deducted) >= maxQuantity}
                                aria-label="Increase quantity"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {lotPicked && (
                            <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                <span>
                                    Lot {selectedLot.lot_number}: {selectedLotRow.remaining.toLocaleString()} pcs free · max{" "}
                                    {maxQuantity.toLocaleString()} {box ? "box(es)" : "pc(s)"}
                                </span>
                                <span className="font-medium text-foreground">Deducts {piecesLabel}</span>
                                <span>
                                    {formatMoney(draftUnitPrice)} / {box ? "box" : "pc"} · Line{" "}
                                    <span className="font-medium text-foreground">{formatMoney(draftLineTotal)}</span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-1.5">
                <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={addItemToBasket}
                    disabled={disabled || !canAddToBasket}
                    aria-describedby={addBlockReason ? id("add_reason") : undefined}
                >
                    <ShoppingBasket className="mr-2 h-4 w-4" />
                    Add to basket
                </Button>
                {addBlockReason && !disabled && (
                    <p id={id("add_reason")} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        {addBlockReason}
                    </p>
                )}
            </div>
        </div>
    );
}
