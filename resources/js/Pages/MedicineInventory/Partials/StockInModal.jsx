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
import { Plus, Trash2 } from "lucide-react";
import useStockIn from "../Hooks/useStockIn";

function formatCurrency(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export default function StockInModal({
    branchId,
    branchName,
    products,
    children,
}) {
    const {
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        selectedProduct,
        productMap,
        addItemToBasket,
        removeItemFromBasket,
        errors,
        processing,
        handleSubmit,
    } = useStockIn({ branchId, products });

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={(isOpen) => !isOpen && closeModal()}>
                <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>New Stock In</DialogTitle>
                            <DialogDescription>
                                Record a delivery and add received items to
                                branch inventory.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Delivery Details
                                </h3>

                                <div className="grid gap-3">
                                    <Label htmlFor="supplier_name">Supplier</Label>
                                    <Input
                                        id="supplier_name"
                                        value={data.supplier_name}
                                        onChange={(event) =>
                                            setData(
                                                "supplier_name",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Supplier name"
                                    />
                                    <InputError message={errors.supplier_name} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="delivery_date">
                                        Delivery Date
                                    </Label>
                                    <Input
                                        id="delivery_date"
                                        type="date"
                                        value={data.delivery_date}
                                        onChange={(event) =>
                                            setData(
                                                "delivery_date",
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.delivery_date} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="branch_name">
                                        Destination Branch
                                    </Label>
                                    <Input
                                        id="branch_name"
                                        value={branchName ?? "No branch assigned"}
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
                                    <Label htmlFor="received_by">Received By</Label>
                                    <Input
                                        id="received_by"
                                        value={data.received_by}
                                        onChange={(event) =>
                                            setData(
                                                "received_by",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Receiver name"
                                    />
                                    <InputError message={errors.received_by} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="remarks">Remarks</Label>
                                    <textarea
                                        id="remarks"
                                        rows={4}
                                        value={data.remarks}
                                        onChange={(event) =>
                                            setData("remarks", event.target.value)
                                        }
                                        placeholder="Optional delivery notes"
                                        className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                    <InputError message={errors.remarks} />
                                </div>
                            </section>

                            <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Items Received Basket
                                </h3>

                                <div className="grid gap-3">
                                    <Label htmlFor="product_select">Medicine</Label>
                                    <select
                                        id="product_select"
                                        value={draft.pd_id}
                                        onChange={(event) =>
                                            updateDraft(
                                                "pd_id",
                                                event.target.value,
                                            )
                                        }
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">Select a medicine</option>
                                        {products.map((product) => (
                                            <option
                                                key={product.id}
                                                value={product.id}
                                                data-brand={product.brand_name ?? ""}
                                                data-dose={product.dose ?? ""}
                                                data-form={product.form ?? ""}
                                                data-retail-price={
                                                    product.retail_price ?? 0
                                                }
                                                data-wholesale-price={
                                                    product.wholesale_price ?? 0
                                                }
                                            >
                                                {product.med_name}
                                                {product.brand_name
                                                    ? ` (${product.brand_name})`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
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
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Retail:
                                                </span>{" "}
                                                ₱
                                                {formatCurrency(
                                                    selectedProduct.retail_price,
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Wholesale:
                                                </span>{" "}
                                                ₱
                                                {formatCurrency(
                                                    selectedProduct.wholesale_price,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="batch_number">
                                            Lot Number
                                        </Label>
                                        <Input
                                            id="batch_number"
                                            value={draft.batch_number}
                                            onChange={(event) =>
                                                updateDraft(
                                                    "batch_number",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="expiry_date">
                                            Expiry Date
                                        </Label>
                                        <Input
                                            id="expiry_date"
                                            type="date"
                                            value={draft.expiry_date}
                                            onChange={(event) =>
                                                updateDraft(
                                                    "expiry_date",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="quantity_received">
                                            Quantity
                                        </Label>
                                        <Input
                                            id="quantity_received"
                                            type="number"
                                            min="1"
                                            value={draft.quantity_received}
                                            onChange={(event) =>
                                                updateDraft(
                                                    "quantity_received",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="shelf_number">
                                            Shelf Number
                                        </Label>
                                        <Input
                                            id="shelf_number"
                                            value={draft.shelf_number}
                                            onChange={(event) =>
                                                updateDraft(
                                                    "shelf_number",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="e.g. A-12"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full"
                                    onClick={addItemToBasket}
                                    disabled={!draft.pd_id}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item to Basket
                                </Button>

                                <InputError message={errors.items} />

                                <div className="space-y-3">
                                    {data.items.length === 0 ? (
                                        <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                                            No items added yet. Select a medicine,
                                            enter lot details, then add it to the
                                            basket.
                                        </p>
                                    ) : (
                                        data.items.map((item, index) => {
                                            const product =
                                                productMap[item.pd_id];

                                            return (
                                                <div
                                                    key={`${item.pd_id}-${item.batch_number}-${index}`}
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
                                                                {item.batch_number}{" "}
                                                                · Exp{" "}
                                                                {item.expiry_date}{" "}
                                                                · Qty{" "}
                                                                {
                                                                    item.quantity_received
                                                                }
                                                                {item.shelf_number
                                                                    ? ` · Shelf ${item.shelf_number}`
                                                                    : ""}
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

                                                    <input
                                                        type="hidden"
                                                        name={`items[${index}][pd_id]`}
                                                        value={item.pd_id}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={`items[${index}][batch_number]`}
                                                        value={item.batch_number}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={`items[${index}][expiry_date]`}
                                                        value={item.expiry_date}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={`items[${index}][quantity_received]`}
                                                        value={
                                                            item.quantity_received
                                                        }
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name={`items[${index}][shelf_number]`}
                                                        value={
                                                            item.shelf_number
                                                        }
                                                    />

                                                    <InputError
                                                        message={
                                                            errors[
                                                                `items.${index}.pd_id`
                                                            ] ||
                                                            errors[
                                                                `items.${index}.batch_number`
                                                            ] ||
                                                            errors[
                                                                `items.${index}.expiry_date`
                                                            ] ||
                                                            errors[
                                                                `items.${index}.quantity_received`
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
                                    processing || data.items.length === 0
                                }
                            >
                                Save Stock In
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
