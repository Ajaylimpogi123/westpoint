import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import InputError from "@/Components/InputError";
import { Minus, Plus, Trash2 } from "lucide-react";
import useStockOutEdit from "../Hooks/useStockOutEdit";
import MedicineSearchSelect from "./MedicineSearchSelect";
import { formatDate } from "@/lib/dates";
import { isBoxUnit, unitLabel } from "@/lib/units";
import { useState } from "react";
function formatLotLabel(lot) {
    const shelf = lot.shelf_number ? ` — Shelf: ${lot.shelf_number}` : "";
    return `Lot ${lot.lot_number} — Exp: ${formatDate(lot.expiry)}${shelf} — ${lot.quantity} pcs`;
}

export default function StockOutEditModal({ stockOutId, children }) {
    const [open, setOpen] = useState(false);

    const {
        UNIT_TYPES,
        loading,
        loadError,
        transactionSubtype,
        data,
        setData,
        draft,
        updateDraft,
        updateQuantity,
        normalizeQuantity,
        selectedProduct,
        availableLots,
        selectedLot,
        maxQuantity,
        piecesLabel,
        boxesUnavailable,
        canAddToBasket,
        productMap,
        products,
        productsLoading,
        productsError,
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
        resetLocal,
    } = useStockOutEdit({ stockOutId, open });

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        resetLocal();
    };

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog
                open={open}
                onOpenChange={(isOpen) => !isOpen && closeModal()}
            >
                <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                    <DialogHeader className="pb-4">
                        <DialogTitle>Edit Stock Out #{stockOutId}</DialogTitle>
                        <DialogDescription>
                            Nothing has been deducted from inventory yet — this
                            just updates what will be deducted once delivery is
                            confirmed.
                        </DialogDescription>
                    </DialogHeader>

                    {loadError ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
                            {loadError}
                        </div>
                    ) : loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading...
                        </div>
                    ) : (
                        <form
                            onSubmit={(e) =>
                                handleSubmit(e, { onSuccess: closeModal })
                            }
                        >
                            <div className="grid gap-6 lg:grid-cols-2">
                                <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                        Transaction Details
                                    </h3>

                                    <div className="grid gap-3">
                                        <Label>Transaction Subtype</Label>
                                        <Input
                                            value={transactionSubtype ?? ""}
                                            readOnly
                                            className="bg-muted"
                                        />
                                    </div>

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_patient_reference">
                                            Patient / Reference
                                        </Label>
                                        <Input
                                            id="edit_patient_reference"
                                            value={data.patient_reference}
                                            onChange={(e) =>
                                                setData(
                                                    "patient_reference",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Patient name or reference"
                                        />
                                        <InputError
                                            message={errors.patient_reference}
                                        />
                                    </div>

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_delivered_to">
                                            Delivered To
                                        </Label>
                                        <Input
                                            id="edit_delivered_to"
                                            value={data.delivered_to}
                                            onChange={(e) =>
                                                setData(
                                                    "delivered_to",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Recipient name / branch / customer"
                                        />
                                        <InputError
                                            message={errors.delivered_to}
                                        />
                                    </div>

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_delivered_to_address">
                                            Delivered To Address
                                        </Label>
                                        <Input
                                            id="edit_delivered_to_address"
                                            value={data.delivered_to_address}
                                            onChange={(e) =>
                                                setData(
                                                    "delivered_to_address",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Delivery address (for the receipt)"
                                        />
                                        <InputError
                                            message={
                                                errors.delivered_to_address
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_issued_by">
                                            Issued By
                                        </Label>
                                        <Input
                                            id="edit_issued_by"
                                            value={data.issued_by}
                                            onChange={(e) =>
                                                setData(
                                                    "issued_by",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Issuer name"
                                        />
                                        <InputError
                                            message={errors.issued_by}
                                        />
                                    </div>

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_remarks">
                                            Remarks
                                        </Label>
                                        <textarea
                                            id="edit_remarks"
                                            rows={4}
                                            value={data.remarks}
                                            onChange={(e) =>
                                                setData(
                                                    "remarks",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="Optional notes"
                                            className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        />
                                        <InputError message={errors.remarks} />
                                    </div>
                                </section>

                                <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                        Items to Deduct
                                    </h3>

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_product_select">
                                            Medicine
                                        </Label>
                                        <MedicineSearchSelect
                                            id="edit_product_select"
                                            products={products}
                                            value={draft.pd_id}
                                            onChange={(productId) =>
                                                updateDraft("pd_id", productId)
                                            }
                                            placeholder={
                                                productsLoading
                                                    ? "Loading medicines..."
                                                    : "Search medicine..."
                                            }
                                            disabled={
                                                productsLoading ||
                                                products.length === 0
                                            }
                                        />
                                        {productsError && (
                                            <p className="text-sm text-destructive">
                                                {productsError}
                                            </p>
                                        )}
                                    </div>

                                    {selectedProduct && (
                                        <div className="grid gap-2 rounded-md border bg-background p-3 text-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <span className="text-muted-foreground">
                                                        Brand:
                                                    </span>{" "}
                                                    {selectedProduct.brand_name ||
                                                        "—"}
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">
                                                        Dose:
                                                    </span>{" "}
                                                    {selectedProduct.dose ||
                                                        "—"}
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">
                                                        Form:
                                                    </span>{" "}
                                                    {selectedProduct.form ||
                                                        "—"}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid gap-3">
                                        <Label htmlFor="edit_lot_select">
                                            Lot
                                        </Label>
                                        <select
                                            id="edit_lot_select"
                                            value={draft.products_qty_id}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "products_qty_id",
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!draft.pd_id}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <option value="">
                                                Select a lot
                                            </option>
                                            {availableLots.map((lot) => (
                                                <option
                                                    key={lot.id}
                                                    value={lot.id}
                                                >
                                                    {formatLotLabel(lot)}
                                                </option>
                                            ))}
                                        </select>
                                        {draft.pd_id &&
                                            availableLots.length === 0 && (
                                                <p className="text-sm text-muted-foreground">
                                                    No available lots for this
                                                    medicine.
                                                </p>
                                            )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_quantity_deducted">
                                            Quantity
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9"
                                                onClick={() =>
                                                    updateQuantity(-1)
                                                }
                                                disabled={
                                                    !draft.products_qty_id ||
                                                    Number(
                                                        draft.quantity_deducted,
                                                    ) <= 1
                                                }
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <Input
                                                id="edit_quantity_deducted"
                                                type="number"
                                                min="1"
                                                step="1"
                                                max={maxQuantity}
                                                value={draft.quantity_deducted}
                                                onChange={(e) =>
                                                    updateDraft(
                                                        "quantity_deducted",
                                                        e.target.value,
                                                    )
                                                }
                                                onBlur={normalizeQuantity}
                                                disabled={
                                                    !draft.products_qty_id
                                                }
                                                className="text-center"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9"
                                                onClick={() =>
                                                    updateQuantity(1)
                                                }
                                                disabled={
                                                    !draft.products_qty_id ||
                                                    Number(
                                                        draft.quantity_deducted,
                                                    ) >= maxQuantity
                                                }
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {selectedLot && (
                                            <div className="space-y-0.5 text-xs text-muted-foreground">
                                                <p>
                                                    Available:{" "}
                                                    {selectedLot.quantity}{" "}
                                                    pieces · max {maxQuantity}{" "}
                                                    {unitLabel(
                                                        draft.unit_type,
                                                    ).toLowerCase()}
                                                </p>
                                                <p className="font-medium text-foreground">
                                                    Deducts {piecesLabel}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_unit_type">
                                            Unit Type
                                        </Label>
                                        <select
                                            id="edit_unit_type"
                                            value={draft.unit_type}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "unit_type",
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!draft.products_qty_id}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            {UNIT_TYPES.map((unitType) => (
                                                <option
                                                    key={unitType.value}
                                                    value={unitType.value}
                                                    disabled={
                                                        boxesUnavailable &&
                                                        isBoxUnit(
                                                            unitType.value,
                                                        )
                                                    }
                                                >
                                                    {unitType.label}
                                                </option>
                                            ))}
                                        </select>
                                        {boxesUnavailable && (
                                            <p className="text-xs text-destructive">
                                                This medicine has no pack size
                                                set, so it can only be dispensed
                                                by the piece.
                                            </p>
                                        )}
                                    </div>

                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="w-full"
                                        onClick={addItemToBasket}
                                        disabled={!canAddToBasket}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Item to Basket
                                    </Button>

                                    <InputError message={errors.items} />

                                    <div className="space-y-3">
                                        {data.items.length === 0 ? (
                                            <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                                                No items yet. Select a medicine
                                                and lot, then add it to the
                                                basket.
                                            </p>
                                        ) : (
                                            data.items.map((item, index) => {
                                                const product =
                                                    productMap[item.pd_id];

                                                return (
                                                    <div
                                                        key={`${item.pd_id}-${item.products_qty_id}-${index}`}
                                                        className="rounded-md border bg-background p-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="space-y-1 text-sm">
                                                                <p className="font-medium">
                                                                    {product?.med_name ??
                                                                        "Unknown medicine"}
                                                                </p>
                                                                <p className="text-muted-foreground">
                                                                    Lot{" "}
                                                                    {
                                                                        item.lot_number
                                                                    }{" "}
                                                                    · Qty{" "}
                                                                    {
                                                                        item.quantity_deducted
                                                                    }{" "}
                                                                    ·{" "}
                                                                    {unitLabel(
                                                                        item.unit_type,
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Deducts{" "}
                                                                    {
                                                                        item.pieces_preview
                                                                    }{" "}
                                                                    pieces
                                                                </p>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    removeItemFromBasket(
                                                                        index,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>

                                                        <InputError
                                                            message={
                                                                errors[
                                                                    `items.${index}.pd_id`
                                                                ] ||
                                                                errors[
                                                                    `items.${index}.products_qty_id`
                                                                ] ||
                                                                errors[
                                                                    `items.${index}.quantity_deducted`
                                                                ] ||
                                                                errors[
                                                                    `items.${index}.unit_type`
                                                                ]
                                                            }
                                                        />
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </section>
                            </div>

                            <DialogFooter className="mt-6">
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={processing}
                                        onClick={closeModal}
                                    >
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    disabled={
                                        processing ||
                                        data.items.length === 0 ||
                                        !data.issued_by.trim()
                                    }
                                >
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
