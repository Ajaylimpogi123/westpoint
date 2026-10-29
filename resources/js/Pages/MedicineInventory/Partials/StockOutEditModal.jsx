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
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import useStockOutEdit from "../Hooks/useStockOutEdit";
import StockOutItemPicker from "./StockOutItemPicker";
import StockOutBasketTable from "./StockOutBasketTable";
import StockOutFormAlerts from "./StockOutFormAlerts";
import StockOutRecipientFields from "./StockOutRecipientFields";
import { DELIVERY_TO_CUSTOMER } from "../lib/stockOutValidation";

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

export default function StockOutEditModal({ stockOutId, children }) {
    const [open, setOpen] = useState(false);

    const edit = useStockOutEdit({ stockOutId, open });
    const {
        loading,
        loadError,
        transactionSubtype,
        branchName,
        formRef,
        data,
        setField,
        products,
        productsLoading,
        productsError,
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
        resetLocal,
    } = edit;

    const isDelivery = transactionSubtype === DELIVERY_TO_CUSTOMER;

    const openModal = () => setOpen(true);
    const closeModal = () => {
        if (processing) {
            return;
        }

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
                <DialogContent
                    className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto overflow-x-hidden p-4 sm:p-6"
                    onInteractOutside={(event) => processing && event.preventDefault()}
                    onEscapeKeyDown={(event) => processing && event.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Edit Stock Out #{stockOutId}</DialogTitle>
                        <DialogDescription>
                            {isDelivery
                                ? "Nothing has been deducted from inventory yet — this just updates what will be deducted once delivery is confirmed."
                                : "This stock already left the branch. Saving puts back what you remove and takes out what you add."}{" "}
                            Fields marked{" "}
                            <span className="text-red-600">*</span> are required.
                        </DialogDescription>
                    </DialogHeader>

                    {loadError ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
                            {loadError}
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                        </div>
                    ) : (
                        <form
                            ref={formRef}
                            onSubmit={(event) =>
                                handleSubmit(event, {
                                    onSuccess: () => setOpen(false),
                                })
                            }
                            noValidate
                            className="min-w-0 space-y-5"
                            aria-busy={processing}
                        >
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

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_branch_name">Source Branch</Label>
                                            <Input
                                                id="edit_branch_name"
                                                value={branchName ?? "—"}
                                                readOnly
                                                className="bg-muted"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit_transaction_subtype">
                                                Transaction Subtype
                                            </Label>
                                            <Input
                                                id="edit_transaction_subtype"
                                                value={transactionSubtype ?? ""}
                                                readOnly
                                                className="bg-muted"
                                            />
                                        </div>
                                    </div>

                                    <StockOutRecipientFields
                                        data={data}
                                        setField={setField}
                                        errors={errors}
                                        recipientRequired={isDelivery}
                                        idPrefix="edit_"
                                        disabled={processing}
                                    />
                                </section>

                                <section className="min-w-0 space-y-4 rounded-lg border bg-muted/20 p-4">
                                    <SectionTitle>Add Medicine</SectionTitle>
                                    <StockOutItemPicker
                                        basket={edit}
                                        products={products}
                                        productsLoading={productsLoading}
                                        productsError={productsError}
                                        emptyMessage={
                                            products.length === 0
                                                ? "No active medicines found for this branch."
                                                : null
                                        }
                                        idPrefix="edit_"
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
                                    idPrefix="edit_"
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
                                        {processing ? "Saving…" : "Save Changes"}
                                    </Button>
                                </div>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
