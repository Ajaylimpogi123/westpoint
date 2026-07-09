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

export default function CheckoutDialog({
    children,
    cartId,
    cartItems,
    discount,
    grossTotal,
    netTotal,
    onCheckoutSuccess,
}) {
    const [open, setOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [amountReceived, setAmountReceived] = useState("");
    const [customerName, setCustomerName] = useState("");
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

    const canConfirm =
        cartId &&
        (paymentMethod === "gcash" ||
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
                customer_name: customerName.trim() || null,
                items: cartItems.map((item) => ({
                    product_id: item.product.id,
                    unit_type: item.unitType,
                    quantity_sold: item.quantity,
                })),
                payment_method: paymentMethod,
                discount_amount: discount,
                amount_received:
                    paymentMethod === "gcash" ? netTotal : received,
            },
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: () => {
                    setOpen(false);
                    setAmountReceived("");
                    setCustomerName("");
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
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setCustomerName("");
                }
            }}
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
                        <Label htmlFor="customer_name">
                            Customer Name{" "}
                            <span className="text-muted-foreground">
                                (optional)
                            </span>
                        </Label>
                        <Input
                            id="customer_name"
                            value={customerName}
                            onChange={(event) =>
                                setCustomerName(event.target.value)
                            }
                            placeholder="Walk-in customer"
                            maxLength={255}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="payment_method">Payment Method</Label>
                        <Select
                            value={paymentMethod}
                            onValueChange={(value) => {
                                setPaymentMethod(value);
                                if (value === "gcash") {
                                    setAmountReceived(String(netTotal));
                                } else {
                                    setAmountReceived("");
                                }
                            }}
                        >
                            <SelectTrigger id="payment_method">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="gcash">GCash</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

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
