import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InputError from "@/components/InputError";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, Save } from "lucide-react";
import useStockOut from "../Hooks/useStockOut";
import BranchChangeConfirmDialog from "./BranchChangeConfirmDialog";
import StockOutItemPicker from "./StockOutItemPicker";
import StockOutBasketTable from "./StockOutBasketTable";
import StockOutFormAlerts from "./StockOutFormAlerts";
import StockOutRecipientFields from "./StockOutRecipientFields";
import { DELIVERY_TO_CUSTOMER } from "../lib/stockOutValidation";

const invalidClass = "border-red-500 focus-visible:ring-red-500";

function SectionTitle({ children, aside }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {children}
            </h3>
            {aside}
        </div>
    );
}

export default function StockOutModal({
    branchId,
    branchName,
    branches = [],
    canAssignBranch = false,
    children,
}) {
    const stockOut = useStockOut({ branchId, canAssignBranch, branches });
    const {
        TRANSACTION_SUBTYPES,
        open,
        openModal,
        closeModal,
        formRef,
        data,
        setField,
        products: branchProducts,
        productsLoading,
        productsError,
        reloadProducts,
        canAssignBranch: canChangeBranch,
        branches: branchOptions,
        handleBranchChange,
        pendingBranchId,
        confirmBranchChange,
        cancelBranchChange,
        basketRows,
        totals,
        updateItem,
        normalizeItem,
        removeItemFromBasket,
        errors,
        generalErrors,
        serverError,
        dismissServerError,
        attempted,
        problemCount,
        processing,
        handleSubmit,
    } = stockOut;

    const isDelivery = data.transaction_subtype === DELIVERY_TO_CUSTOMER;

    const emptyMessage = !data.branch_id
        ? "Choose a source branch to load its medicines."
        : branchProducts.length === 0
          ? "No active medicines found for this branch."
          : null;

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog
                open={open}
                onOpenChange={(isOpen) => !isOpen && closeModal()}
            >
                <DialogContent
                    className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto overflow-x-hidden p-4 sm:p-6"
                    // Don't lose the basket to a stray click outside while saving.
                    onInteractOutside={(event) => processing && event.preventDefault()}
                    onEscapeKeyDown={(event) => processing && event.preventDefault()}
                >
                    <form
                        ref={formRef}
                        onSubmit={handleSubmit}
                        noValidate
                        className="min-w-0 space-y-5"
                        aria-busy={processing}
                    >
                        <DialogHeader>
                            <DialogTitle>New Stock Out</DialogTitle>
                            <DialogDescription>
                                Record stock leaving a branch, by lot. Fields
                                marked <span className="text-red-600">*</span>{" "}
                                are required.
                            </DialogDescription>
                        </DialogHeader>

                        <StockOutFormAlerts
                            serverError={serverError}
                            onDismissServerError={dismissServerError}
                            generalErrors={generalErrors}
                            attempted={attempted}
                            problemCount={problemCount}
                        />

                        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                            <section className="min-w-0 space-y-4 rounded-lg border bg-muted/20 p-4">
                                <SectionTitle>Transaction Details</SectionTitle>

                                <div className="grid gap-2" data-field="transaction_subtype">
                                    <Label htmlFor="transaction_subtype">
                                        Transaction Subtype
                                        <span className="text-red-600" aria-hidden="true"> *</span>
                                    </Label>
                                    <select
                                        id="transaction_subtype"
                                        value={data.transaction_subtype}
                                        onChange={(event) =>
                                            setField("transaction_subtype", event.target.value)
                                        }
                                        disabled={processing}
                                        aria-required
                                        aria-invalid={Boolean(errors.transaction_subtype) || undefined}
                                        className={cn(
                                            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                            errors.transaction_subtype && invalidClass,
                                        )}
                                    >
                                        <option value="">Select subtype</option>
                                        {TRANSACTION_SUBTYPES.map((subtype) => (
                                            <option key={subtype} value={subtype}>
                                                {subtype}
                                            </option>
                                        ))}
                                    </select>
                                    {data.transaction_subtype && !errors.transaction_subtype && (
                                        <p className="text-xs text-muted-foreground">
                                            {isDelivery
                                                ? "Stock is deducted when the delivery is confirmed."
                                                : "Stock is deducted as soon as this is saved."}
                                        </p>
                                    )}
                                    <InputError message={errors.transaction_subtype} />
                                </div>

                                <div className="grid gap-2" data-field="branch_id">
                                    <Label htmlFor={canChangeBranch ? "branch_id" : "branch_name"}>
                                        Source Branch
                                        {canChangeBranch && (
                                            <span className="text-red-600" aria-hidden="true"> *</span>
                                        )}
                                    </Label>
                                    {canChangeBranch ? (
                                        <Select
                                            value={data.branch_id || undefined}
                                            onValueChange={handleBranchChange}
                                            disabled={processing}
                                        >
                                            <SelectTrigger
                                                id="branch_id"
                                                aria-invalid={Boolean(errors.branch_id) || undefined}
                                                className={cn(errors.branch_id && invalidClass)}
                                            >
                                                <SelectValue placeholder="Select branch" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {branchOptions.map((branch) => (
                                                    <SelectItem
                                                        key={branch.id}
                                                        value={String(branch.id)}
                                                    >
                                                        {branch.branch_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id="branch_name"
                                            value={branchName ?? "No branch assigned"}
                                            readOnly
                                            className="bg-muted"
                                        />
                                    )}
                                    {canChangeBranch && data.items.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Changing the branch empties the basket.
                                        </p>
                                    )}
                                    <InputError message={errors.branch_id} />
                                </div>

                                <StockOutRecipientFields
                                    data={data}
                                    setField={setField}
                                    errors={errors}
                                    recipientRequired={isDelivery}
                                    disabled={processing}
                                />
                            </section>

                            <section className="min-w-0 space-y-4 rounded-lg border bg-muted/20 p-4">
                                <SectionTitle>Add Medicine</SectionTitle>
                                <StockOutItemPicker
                                    basket={stockOut}
                                    products={branchProducts}
                                    productsLoading={productsLoading}
                                    productsError={productsError}
                                    onRetry={reloadProducts}
                                    searchDisabled={!data.branch_id}
                                    emptyMessage={emptyMessage}
                                    disabled={processing}
                                />
                            </section>
                        </div>

                        <section className="min-w-0 space-y-3" data-field="items">
                            <SectionTitle
                                aside={
                                    totals.lines > 0 && (
                                        <span className="text-sm text-muted-foreground">
                                            {totals.lines} {totals.lines === 1 ? "line" : "lines"} ·{" "}
                                            {totals.pieces.toLocaleString()} pcs
                                        </span>
                                    )
                                }
                            >
                                Basket
                            </SectionTitle>
                            <InputError message={errors.items} />
                            <StockOutBasketTable
                                rows={basketRows}
                                totals={totals}
                                errors={errors}
                                onUpdateItem={updateItem}
                                onNormalizeItem={normalizeItem}
                                onRemove={removeItemFromBasket}
                                disabled={processing}
                            />
                        </section>

                        <DialogFooter className="flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
                            <p className="text-sm text-muted-foreground" aria-live="polite">
                                {processing
                                    ? "Saving — please wait."
                                    : attempted && problemCount > 0
                                      ? `${problemCount} ${problemCount === 1 ? "issue" : "issues"} to fix before saving.`
                                      : data.items.length === 0
                                        ? "Add at least one medicine to save."
                                        : null}
                            </p>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={processing}
                                    onClick={closeModal}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    {processing ? "Saving…" : "Save Stock Out"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>

                    <BranchChangeConfirmDialog
                        pendingBranchId={pendingBranchId}
                        branches={branchOptions}
                        itemCount={data.items.length}
                        onConfirm={confirmBranchChange}
                        onCancel={cancelBranchChange}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
