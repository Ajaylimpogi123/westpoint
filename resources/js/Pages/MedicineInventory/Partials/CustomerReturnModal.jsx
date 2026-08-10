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
import { Plus, Trash2, UserPlus } from "lucide-react";
import useCustomerReturn from "../Hooks/useCustomerReturn";
import MedicineSearchSelect from "./MedicineSearchSelect";
import { isBoxUnit, unitLabel } from "@/lib/units";
import NewCustomerModal from "./NewCustomerModal";
import CustomerSearchSelect from "./CustomerSearchSelect";

export default function CustomerReturnModal({
    branchId,
    branchName,
    products,
    branches = [],
    canAssignBranch = false,
    children,
}) {
    const {
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        data,
        setData,
        draft,
        updateDraft,
        normalizeQuantity,
        selectedProduct,
        boxesUnavailable,
        canAddToBasket,
        productMap,
        products: branchProducts,
        productsLoading,
        productsError,
        customers,
        customersLoading,
        customersError,
        addCustomerToList,
        canAssignBranch: canChangeBranch,
        branches: branchOptions,
        handleBranchChange,
        addItemToBasket,
        removeItemFromBasket,
        piecesLabel,
        existingLots,
        applyExistingLot,
        needsDuplicateConfirmation,
        errors,
        processing,
        handleSubmit,
    } = useCustomerReturn({ branchId, products, canAssignBranch, branches });

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog
                open={open}
                onOpenChange={(isOpen) => !isOpen && closeModal()}
            >
                <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                    <form onSubmit={handleSubmit}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>New Return from Customer</DialogTitle>
                            <DialogDescription>
                                Record medicine returned by a customer and add
                                it back to branch inventory.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-6 lg:grid-cols-2">
                            <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Return Details
                                </h3>

                                <div className="grid gap-3">
                                    <Label htmlFor="branch_id">Branch</Label>
                                    {canChangeBranch ? (
                                        <select
                                            id="branch_id"
                                            value={data.branch_id}
                                            onChange={(e) =>
                                                handleBranchChange(
                                                    e.target.value,
                                                )
                                            }
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <option value="">
                                                Select branch
                                            </option>
                                            {branchOptions.map((branch) => (
                                                <option
                                                    key={branch.id}
                                                    value={String(branch.id)}
                                                >
                                                    {branch.branch_name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input
                                            value={
                                                branchName ??
                                                "No branch assigned"
                                            }
                                            readOnly
                                            className="bg-muted"
                                        />
                                    )}
                                    <input
                                        type="hidden"
                                        name="branch_id"
                                        value={data.branch_id}
                                    />
                                    <InputError message={errors.branch_id} />
                                </div>

                                <div className="grid gap-3">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="customer_id">
                                            Customer
                                        </Label>
                                        <NewCustomerModal
                                            branchId={
                                                Number(data.branch_id) || null
                                            }
                                            onCreated={addCustomerToList}
                                        >
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 gap-1 text-xs"
                                                disabled={!data.branch_id}
                                            >
                                                <UserPlus className="h-3.5 w-3.5" />
                                                New Customer
                                            </Button>
                                        </NewCustomerModal>
                                    </div>

                                    <CustomerSearchSelect
                                        id="customer_id"
                                        customers={customers}
                                        value={data.customer_id}
                                        onChange={(customerId) =>
                                            setData("customer_id", customerId)
                                        }
                                        placeholder={
                                            customersLoading
                                                ? "Loading customers..."
                                                : !data.branch_id
                                                  ? "Select a branch first"
                                                  : "Search customer..."
                                        }
                                        disabled={
                                            customersLoading || !data.branch_id
                                        }
                                    />

                                    {customersError && (
                                        <p className="text-sm text-destructive">
                                            {customersError}
                                        </p>
                                    )}
                                    {!customersLoading &&
                                        data.branch_id &&
                                        customers.length === 0 &&
                                        !customersError && (
                                            <p className="text-sm text-muted-foreground">
                                                No customers found for this
                                                branch — add one with the button
                                                above.
                                            </p>
                                        )}
                                    <InputError message={errors.customer_id} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="return_date">
                                        Return Date
                                    </Label>
                                    <Input
                                        id="return_date"
                                        type="date"
                                        value={data.return_date}
                                        onChange={(e) =>
                                            setData(
                                                "return_date",
                                                e.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.return_date} />
                                </div>

                                <div className="grid gap-3">
                                    <Label htmlFor="received_by">
                                        Received By
                                    </Label>
                                    <Input
                                        id="received_by"
                                        value={data.received_by}
                                        onChange={(e) =>
                                            setData(
                                                "received_by",
                                                e.target.value,
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
                                        onChange={(e) =>
                                            setData("remarks", e.target.value)
                                        }
                                        placeholder="Reason for return, condition, etc."
                                        className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                    <InputError message={errors.remarks} />
                                </div>
                            </section>

                            <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                    Items Returned
                                </h3>

                                <div className="grid gap-3">
                                    <Label htmlFor="product_select">
                                        Medicine
                                    </Label>
                                    <MedicineSearchSelect
                                        id="product_select"
                                        products={branchProducts}
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
                                            !data.branch_id ||
                                            branchProducts.length === 0
                                        }
                                    />
                                    {productsError && (
                                        <p className="text-sm text-destructive">
                                            {productsError}
                                        </p>
                                    )}
                                </div>

                                {selectedProduct && existingLots.length > 0 && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="existing_batch_pick">
                                            Return into an existing batch
                                        </Label>
                                        <select
                                            id="existing_batch_pick"
                                            value=""
                                            onChange={(e) => {
                                                const lot = existingLots.find(
                                                    (batch) =>
                                                        String(batch.id) ===
                                                        e.target.value,
                                                );
                                                if (lot) applyExistingLot(lot);
                                            }}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <option value="">
                                                Select a batch to fill lot
                                                details…
                                            </option>
                                            {existingLots.map((lot) => (
                                                <option
                                                    key={lot.id}
                                                    value={lot.id}
                                                >
                                                    {lot.lot_number} · exp{" "}
                                                    {lot.expiry
                                                        ? String(
                                                              lot.expiry,
                                                          ).slice(0, 10)
                                                        : "no expiry"}{" "}
                                                    ·{" "}
                                                    {Number(lot.quantity) || 0}{" "}
                                                    pcs
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="batch_number">
                                            Lot Number
                                        </Label>
                                        <Input
                                            id="batch_number"
                                            value={draft.batch_number}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "batch_number",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="expiry_date">
                                            Expiry Date
                                        </Label>
                                        <Input
                                            id="expiry_date"
                                            type="date"
                                            value={draft.expiry_date}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "expiry_date",
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="grid min-w-0 gap-2">
                                        <Label htmlFor="quantity_received">
                                            Quantity
                                        </Label>
                                        <Input
                                            id="quantity_received"
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={draft.quantity_received}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "quantity_received",
                                                    e.target.value,
                                                )
                                            }
                                            onBlur={normalizeQuantity}
                                        />
                                        {draft.pd_id && (
                                            <p className="text-xs font-medium text-foreground">
                                                Adds {piecesLabel}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {needsDuplicateConfirmation && (
                                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                                        <input
                                            type="checkbox"
                                            className="mt-0.5"
                                            checked={
                                                draft.confirm_duplicate_lot
                                            }
                                            onChange={(e) =>
                                                updateDraft(
                                                    "confirm_duplicate_lot",
                                                    e.target.checked,
                                                )
                                            }
                                        />
                                        <span>
                                            I confirm this is a separate batch
                                            with the same lot number (not a typo
                                            on the expiry date).
                                        </span>
                                    </label>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="shelf_number">
                                            Shelf Number
                                        </Label>
                                        <Input
                                            id="shelf_number"
                                            value={draft.shelf_number}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "shelf_number",
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="e.g. A-12"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="unit_type">
                                            Unit Type
                                        </Label>
                                        <select
                                            id="unit_type"
                                            value={draft.unit_type}
                                            onChange={(e) =>
                                                updateDraft(
                                                    "unit_type",
                                                    e.target.value,
                                                )
                                            }
                                            disabled={!draft.pd_id}
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
                                                No pack size set — receive by
                                                the piece.
                                            </p>
                                        )}
                                    </div>
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
                                            No items added yet.
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
                                                                {
                                                                    item.batch_number
                                                                }{" "}
                                                                · Exp{" "}
                                                                {
                                                                    item.expiry_date
                                                                }{" "}
                                                                · Qty{" "}
                                                                {
                                                                    item.quantity_received
                                                                }{" "}
                                                                ·{" "}
                                                                {unitLabel(
                                                                    item.unit_type,
                                                                )}
                                                                {isBoxUnit(
                                                                    item.unit_type,
                                                                ) &&
                                                                    ` (${item.pieces_preview} pcs)`}
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
                                                                `items.${index}.batch_number`
                                                            ] ||
                                                            errors[
                                                                `items.${index}.expiry_date`
                                                            ] ||
                                                            errors[
                                                                `items.${index}.quantity_received`
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
                                    !data.customer_id ||
                                    !data.received_by.trim()
                                }
                            >
                                Save Return
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
