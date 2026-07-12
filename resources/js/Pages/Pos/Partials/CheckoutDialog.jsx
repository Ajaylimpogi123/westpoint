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
import { formatCustomerName } from "../lib/customerDiscount";

export default function CheckoutDialog({
    children,
    cartId,
    cartItems,
    discount,
    grossTotal,
    netTotal,
    selectedCustomer,
    onCheckoutSuccess,
}) {
    const [open, setOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [amountReceived, setAmountReceived] = useState("");
    const [processing, setProcessing] = useState(false);
    const [reviewItems, setReviewItems] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState("");

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
        paymentMethod === "gcash" || paymentMethod === "card";

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

        router.post(
            route("pos.store"),
            {
                cart_id: cartId,
                customer_id: selectedCustomer?.customer_id ?? null,
                customer_name: selectedCustomer
                    ? formatCustomerName(selectedCustomer)
                    : null,
                items: cartItems.map((item) => ({
                    product_id: item.product.id,
                    unit_type: item.unitType,
                    quantity_sold: item.quantity,
                })),
                payment_method: paymentMethod,
                reference_number: requiresReferenceNumber
                    ? referenceNumber.trim()
                    : null,
                discount_amount: discount,
                amount_received: requiresReferenceNumber ? netTotal : received,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => {
                    setOpen(false);
                    setAmountReceived("");
                    setReferenceNumber("");
                    setPaymentMethod("cash");
                    onCheckoutSuccess?.();
                },
                onError: (errors) => {
                    const message =
                        Object.values(errors)[0] ||
                        "Failed to complete sale. Please try again.";
                    toast.error(message);
                },
                onFinish: () => {
                    setProcessing(false);
                },
            },
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
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
                            <span>Discount</span>
                            <span>-{formatCurrency(discount)}</span>
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
                                        selectedCustomer.phone_number,
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
                                if (value === "gcash" || value === "card") {
                                    setAmountReceived(String(netTotal));
                                    setReferenceNumber("");
                                } else {
                                    setAmountReceived("");
                                    setReferenceNumber("");
                                }
                            }}
                        >
                            <SelectTrigger id="payment_method">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="gcash">GCash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
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
