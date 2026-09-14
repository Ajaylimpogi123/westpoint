import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import CheckoutReview from "./CheckoutReview";
import { fetchCheckoutPreview } from "../lib/posCartApi";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "../lib/pricing";
import { getCustomerIdNumber } from "@/Pages/CustomerManagement/lib/customerType";
import { formatCustomerName } from "../lib/customerDiscount";
import { newIdempotencyKey } from "@/lib/idempotency";

export default function CheckoutDialog({
    children,
    cartId,
    cartItems,
    discountPercent,
    discountAmount,
    grossTotal,
    netTotal,
    selectedCustomer,
    onCheckoutSuccess,
}) {
    const [open, setOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [salesRemarks, setSalesRemarks] = useState("");
    const [amountReceived, setAmountReceived] = useState("");
    const [processing, setProcessing] = useState(false);
    const [reviewItems, setReviewItems] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState("");
    const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

    useEffect(() => {
        if (!open || !cartId || cartItems.length === 0) {
            setReviewItems([]);
            setReviewError("");
            return;
        }

        let cancelled = false;

        const loadReview = async () => {
            setReviewLoading(true);
            setReviewError("");

            try {
                const data = await fetchCheckoutPreview();
                if (!cancelled) {
                    setReviewItems(data.items ?? []);
                }
            } catch (error) {
                if (!cancelled) {
                    setReviewItems([]);
                    setReviewError(
                        error?.response?.data?.message ||
                            "Failed to load medicine review.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setReviewLoading(false);
                }
            }
        };

        loadReview();

        return () => {
            cancelled = true;
        };
    }, [open, cartId, cartItems]);

    const received = Number(amountReceived) || 0;
    const changeDue =
        paymentMethod === "cash" ? Math.max(received - netTotal, 0) : 0;

    const requiresReferenceNumber =
        paymentMethod === "gcash" ||
        paymentMethod === "debit_card" ||
        paymentMethod === "credit_card" ||
        paymentMethod === "PH_GAMOT" ||
        paymentMethod === "bank_transfer" ||
        paymentMethod === "others";

    // Remarks are only meaningful for the two methods that don't have a
    // structured reference to point to on their own — a note explaining
    // the payment (which bank, who authorized it, etc).
    const showRemarks =
        paymentMethod === "bank_transfer" || paymentMethod === "others";

    const canConfirm =
        cartId &&
        ((requiresReferenceNumber && referenceNumber.trim() !== "") ||
            (paymentMethod === "cash" && received >= netTotal));

    const handleConfirm = () => {
        if (!cartId) {
            toast.error("Active cart not found. Please refresh and try again.");
            return;
        }

        setProcessing(true);

        // Derived, not separately tracked: a 20% discount only maps to a
        // specific label when it lines up with the selected customer's
        // record; otherwise it stays generic rather than guessing.
        const discountType =
            discountPercent === 20 &&
            (selectedCustomer?.customer_type === "Senior Citizen" ||
                selectedCustomer?.customer_type === "PWD")
                ? selectedCustomer.customer_type
                : discountPercent === 10
                  ? "Single Mother"
                  : discountPercent > 0
                    ? "PWD / Senior"
                    : null;

        // Must open synchronously within the click handler so the browser
        // does not treat it as a blocked popup once the request resolves.
        const invoiceWindow = window.open("", "_blank");

        router.post(
            route("pos.store"),
            {
                idempotency_key: idempotencyKey,
                cart_id: cartId,
                customer_id: selectedCustomer?.customer_id ?? null,
                customer_name: selectedCustomer
                    ? formatCustomerName(selectedCustomer)
                    : null,
                items: cartItems.map((item) => ({
                    product_id: item.product.id,
                    unit_type: item.unitType,
                    quantity_sold: item.quantity,
                    apply_discount: Boolean(item.applyDiscount),
                    vat_exempt: Boolean(item.vatExempt),
                })),
                payment_method: paymentMethod,
                reference_number: requiresReferenceNumber
                    ? referenceNumber.trim()
                    : null,
                sales_remarks: showRemarks ? salesRemarks.trim() || null : null,
                discount_amount: discountAmount,
                discount_percent: discountPercent,
                discount_type: discountType,
                amount_received: requiresReferenceNumber ? netTotal : received,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: (page) => {
                    setOpen(false);
                    setAmountReceived("");
                    setReferenceNumber("");
                    setSalesRemarks("");
                    setPaymentMethod("cash");
                    setIdempotencyKey(newIdempotencyKey());
                    onCheckoutSuccess?.();

                    const saleId = page?.props?.flash?.sale_id;

                    if (invoiceWindow && saleId) {
                        invoiceWindow.location = route(
                            "pos.sales.invoice",
                            saleId,
                        );
                    } else {
                        invoiceWindow?.close();
                    }
                },
                onError: (errors) => {
                    const message =
                        Object.values(errors)[0] ||
                        "Failed to complete sale. Please try again.";
                    toast.error(message);
                    invoiceWindow?.close();
                },
                onFinish: () => {
                    setProcessing(false);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Checkout</DialogTitle>
                    <DialogDescription>
                        Review medicines and confirm payment to complete this
                        sale.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 overflow-y-auto py-2 pr-1">
                    <CheckoutReview
                        items={reviewItems}
                        loading={reviewLoading}
                        error={reviewError}
                    />

                    <div className="rounded-lg bg-muted/50 p-4 text-sm">
                        <div className="flex justify-between">
                            <span>Gross Total</span>
                            <span>{formatCurrency(grossTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>
                                Discount
                                {discountPercent > 0
                                    ? ` (${discountPercent}%)`
                                    : ""}
                            </span>
                            <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                            <span>Net Total</span>
                            <span className="text-green-700">
                                {formatCurrency(netTotal)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Customer</Label>
                        {selectedCustomer ? (
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                                <div className="font-medium">
                                    {formatCustomerName(selectedCustomer)}
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                    {[
                                        getCustomerIdNumber(selectedCustomer),
                                        selectedCustomer.customer_type,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                Walk-in customer
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="payment_method">Payment Method</Label>
                        <Select
                            value={paymentMethod}
                            onValueChange={(value) => {
                                setPaymentMethod(value);
                                if (
                                    value === "gcash" ||
                                    value === "debit_card" ||
                                    value === "credit_card" ||
                                    value === "PH_GAMOT" ||
                                    value === "bank_transfer" ||
                                    value === "others"
                                ) {
                                    setAmountReceived(String(netTotal));
                                    setReferenceNumber("");
                                } else {
                                    setAmountReceived("");
                                    setReferenceNumber("");
                                }
                                setSalesRemarks("");
                            }}
                        >
                            <SelectTrigger id="payment_method">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="gcash">GCash</SelectItem>
                                <SelectItem value="debit_card">
                                    Debit Card
                                </SelectItem>
                                <SelectItem value="credit_card">
                                    Credit Card
                                </SelectItem>
                                <SelectItem value="PH_GAMOT">
                                    PH GAMOT
                                </SelectItem>
                                <SelectItem value="bank_transfer">
                                    Bank Transfer
                                </SelectItem>
                                <SelectItem value="others">Others</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {requiresReferenceNumber && (
                        <div className="space-y-2">
                            <Label htmlFor="reference_number">
                                Reference Number
                            </Label>
                            <Input
                                id="reference_number"
                                type="text"
                                value={referenceNumber}
                                onChange={(event) =>
                                    setReferenceNumber(event.target.value)
                                }
                                placeholder="Enter transaction reference"
                            />
                        </div>
                    )}

                    {showRemarks && (
                        <div className="space-y-2">
                            <Label htmlFor="sales_remarks">
                                Remarks
                                <span className="ml-1 font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </Label>
                            <textarea
                                id="sales_remarks"
                                rows={3}
                                value={salesRemarks}
                                onChange={(event) =>
                                    setSalesRemarks(event.target.value)
                                }
                                placeholder={
                                    paymentMethod === "bank_transfer"
                                        ? "e.g. transferred to BDO account, sent by Juan Dela Cruz"
                                        : "Describe the payment method used"
                                }
                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                    )}

                    {paymentMethod === "cash" && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="amount_received">
                                    Amount Received
                                </Label>
                                <Input
                                    id="amount_received"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amountReceived}
                                    onChange={(event) =>
                                        setAmountReceived(event.target.value)
                                    }
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="flex justify-between rounded-lg border p-3 text-sm">
                                <span className="font-medium">Change Due</span>
                                <span className="font-bold">
                                    {formatCurrency(changeDue)}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!canConfirm || processing}
                    >
                        {processing ? "Processing..." : "Confirm Sale"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
