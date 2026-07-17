import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputError from "@/Components/InputError";
import { Minus, Plus, Trash2 } from "lucide-react";
import useStockOut from "../Hooks/useStockOut";
import MedicineSearchSelect from "./MedicineSearchSelect";

function formatExpiry(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
}

function formatLotLabel(lot) {
    return `Lot ${lot.lot_number} — Exp: ${formatExpiry(lot.expiry)} — Qty: ${lot.quantity}`;
}

export default function StockOutModal({
    branchId,
    branchName,
    products,
    children,
}) {
    const {
        TRANSACTION_SUBTYPES,
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
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
        productMap,
        products: productList,
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
    } = useStockOut({ branchId, products });

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeModal()}>
                <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>New Stock Out</DialogTitle>
                            <DialogDescription>
                                Record stock deductions from branch inventory
                                by lot.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Transaction Details
                                </h3>

                                <div className="grid gap-3">
                                    <Label htmlFor="transaction_subtype">
                                        Transaction Subtype
                                    </Label>
                                    <select
                                        id="transaction_subtype"
                                        value={data.transaction_subtype}
                                        onChange={(event) =>
                                            setData(
                                                "transaction_subtype",
                                                event.target.value,
                                            )
                                        }
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">Select subtype</option>
                                        {TRANSACTION_SUBTYPES.map((subtype) => (
                                            <option key={subtype} value={subtype}>
                                                {subtype}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError
                                        message={errors.transaction_subtype}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="branch_name">
                                        Source Warehouse
                                    </Label>
                                    <Input
                                        id="branch_name"
                                        value={
                                            branchName ?? "No branch assigned"
                                        }
                                        readOnly
                                        className="bg-muted"
                                    />
                                    <input
                                        type="hidden"
                                        name="branch_id"
                                        value={data.branch_id}
                                    />
                                    <InputError message={errors.branch_id} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="patient_reference">
                                        Patient / Reference
                                    </Label>
                                    <Input
                                        id="patient_reference"
                                        value={data.patient_reference}
                                        onChange={(event) =>
                                            setData(
                                                "patient_reference",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Patient name or reference"
                                    />
                                    <InputError
                                        message={errors.patient_reference}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="delivered_to">
                                        Delivered To
                                    </Label>
                                    <Input
                                        id="delivered_to"
                                        value={data.delivered_to}
                                        onChange={(event) =>
                                            setData(
                                                "delivered_to",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Recipient name / branch / customer"
                                    />
                                    <InputError
                                        message={errors.delivered_to}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="delivered_to_address">
                                        Delivered To Address
                                    </Label>
                                    <Input
                                        id="delivered_to_address"
                                        value={data.delivered_to_address}
                                        onChange={(event) =>
                                            setData(
                                                "delivered_to_address",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Delivery address (for the receipt)"
                                    />
                                    <InputError
                                        message={errors.delivered_to_address}
                                    />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="issued_by">Issued By</Label>
                                    <Input
                                        id="issued_by"
                                        value={data.issued_by}
                                        onChange={(event) =>
                                            setData(
                                                "issued_by",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Issuer name"
                                    />
                                    <InputError message={errors.issued_by} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="remarks">Remarks</Label>
                                    <textarea
                                        id="remarks"
                                        rows={4}
                                        value={data.remarks}
                                        onChange={(event) =>
                                            setData(
                                                "remarks",
                                                event.target.value,
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
                                    <Label htmlFor="product_select">
                                        Medicine
                                    </Label>
                                    <MedicineSearchSelect
                                        id="product_select"
                                        products={productList}
                                        value={draft.pd_id}
                                        onChange={(productId) =>
                                            updateDraft("pd_id", productId)
                                        }
                                        placeholder="Search medicine..."
                                    />
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
                                                {selectedProduct.dose || "—"}
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Form:
                                                </span>{" "}
                                                {selectedProduct.form || "—"}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-3">
                                    <Label htmlFor="lot_select">Lot</Label>
                                    <select
                                        id="lot_select"
                                        value={draft.lot_number}
                                        onChange={(event) =>
                                            updateDraft(
                                                "lot_number",
                                                event.target.value,
                                            )
                                        }
                                        disabled={!draft.pd_id}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">Select a lot</option>
                                        {availableLots.map((lot) => (
                                            <option
                                                key={lot.id}
                                                value={lot.lot_number}
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
                                    <Label htmlFor="quantity_deducted">
                                        Quantity
                                    </Label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => updateQuantity(-1)}
                                            disabled={
                                                !draft.lot_number ||
                                                Number(
                                                    draft.quantity_deducted,
                                                ) <= 1
                                            }
                                        >
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                            id="quantity_deducted"
                                            type="number"
                                            min="1"
                                            max={maxQuantity}
                                            value={draft.quantity_deducted}
                                            onChange={(event) =>
                                                updateDraft(
                                                    "quantity_deducted",
                                                    event.target.value,
                                                )
                                            }
                                            onBlur={normalizeQuantity}
                                            disabled={!draft.lot_number}
                                            className="text-center"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => updateQuantity(1)}
                                            disabled={
                                                !draft.lot_number ||
                                                Number(
                                                    draft.quantity_deducted,
                                                ) >= maxQuantity
                                            }
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {selectedLot && (
                                        <p className="text-xs text-muted-foreground">
                                            Available: {selectedLot.quantity}{" "}
                                            piece
                                            {Number(selectedLot.quantity) === 1
                                                ? ""
                                                : "s"}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="unit_type">
                                        Unit Type
                                    </Label>
                                    <select
                                        id="unit_type"
                                        value={draft.unit_type}
                                        onChange={(event) =>
                                            updateDraft(
                                                "unit_type",
                                                event.target.value,
                                            )
                                        }
                                        disabled={!draft.lot_number}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        {UNIT_TYPES.map((unitType) => (
                                            <option
                                                key={unitType.value}
                                                value={unitType.value}
                                            >
                                                {unitType.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">
                                        Determines which price (retail or
                                        wholesale) is used on the printed
                                        delivery receipt.
                                    </p>
                                </div>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full"
                                    onClick={addItemToBasket}
                                    disabled={
                                        !draft.pd_id ||
                                        !draft.lot_number ||
                                        Number(draft.quantity_deducted) < 1
                                    }
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item to Basket
                                </Button>

                                <InputError message={errors.items} />

                                <div className="space-y-3">
                                    {data.items.length === 0 ? (
                                        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                                            No items added yet. Select a
                                            medicine and lot, then add it to
                                            the basket.
                                        </p>
                                    ) : (
                                        data.items.map((item, index) => {
                                            const product =
                                                productMap[item.pd_id];

                                            return (
                                                <div
                                                    key={`${item.pd_id}-${item.lot_number}-${index}`}
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
                                                                {item.lot_number}{" "}
                                                                · Qty{" "}
                                                                {
                                                                    item.quantity_deducted
                                                                }{" "}
                                                                ·{" "}
                                                                {item.unit_type ===
                                                                "box"
                                                                    ? "Box / Wholesale"
                                                                    : "Piece"}
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
                                                                `items.${index}.lot_number`
                                                            ] ||
                                                            errors[
                                                                `items.${index}.quantity_deducted`
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
                                    !data.transaction_subtype ||
                                    !data.issued_by.trim()
                                }
                            >
                                Save Stock Out
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
