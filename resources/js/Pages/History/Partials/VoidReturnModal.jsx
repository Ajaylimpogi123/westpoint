import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { router } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Undo2 } from "lucide-react";

const formatCurrency = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const productLabel = (item) => {
    const parts = [item.product_name, item.brand_name].filter(Boolean);
    return parts.join(" — ") || "Product";
};

export default function VoidReturnModal({ saleId, children }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [items, setItems] = useState([]);
    // sale_item_id -> quantity string the cashier typed
    const [quantities, setQuantities] = useState({});
    const [reason, setReason] = useState("");
    const [receivedBy, setReceivedBy] = useState("");

    const openModal = async () => {
        if (!saleId) {
            toast.error("Sale ID not found");
            return;
        }

        setOpen(true);
        setLoading(true);
        setQuantities({});
        setReason("");
        setReceivedBy("");

        try {
            const response = await axios.get(
                route("history.returnable", saleId),
            );
            setItems(response.data.items ?? []);
        } catch {
            toast.error("Failed to load sale items");
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const setQuantityFor = (saleItemId, value, max) => {
        const parsed = Math.floor(Number(value));
        const clamped = Number.isFinite(parsed)
            ? Math.max(0, Math.min(parsed, max))
            : 0;

        setQuantities((current) => ({
            ...current,
            [saleItemId]: clamped === 0 ? "" : String(clamped),
        }));
    };

    const selectedLines = items
        .map((item) => ({
            item,
            quantity: Number(quantities[item.sale_item_id]) || 0,
        }))
        .filter((line) => line.quantity > 0);

    const canSubmit =
        selectedLines.length > 0 && reason.trim() !== "" && !submitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;

        setSubmitting(true);

        try {
            await axios.post(route("history.void", saleId), {
                items: selectedLines.map((line) => ({
                    sale_item_id: line.item.sale_item_id,
                    quantity_returned: line.quantity,
                })),
                reason: reason.trim(),
                received_by: receivedBy.trim() || undefined,
            });

            toast.success("Return processed and stock restocked.");
            setOpen(false);
            router.reload({ only: ["sales"] });
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                "Failed to process the return. Please try again.";
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Void / Return Items</DialogTitle>
                        <DialogDescription>
                            Select which items and how many to void or return.
                            Stock is restocked to its original batch.
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading sale items...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                {items.map((item) => {
                                    const remaining = item.remaining_quantity;
                                    const disabled = remaining <= 0;

                                    return (
                                        <div
                                            key={item.sale_item_id}
                                            className={`rounded-md border p-3 text-sm ${
                                                disabled ? "opacity-50" : ""
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium">
                                                        {productLabel(item)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Sold{" "}
                                                        {item.quantity_sold}{" "}
                                                        {item.unit_type} ·
                                                        Already returned{" "}
                                                        {item.returned_quantity}{" "}
                                                        · Remaining {remaining}{" "}
                                                        ·{" "}
                                                        {formatCurrency(
                                                            item.price_used,
                                                        )}{" "}
                                                        each
                                                    </p>
                                                </div>
                                                <div className="w-24 shrink-0">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={remaining}
                                                        placeholder="0"
                                                        disabled={disabled}
                                                        value={
                                                            quantities[
                                                                item
                                                                    .sale_item_id
                                                            ] ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            setQuantityFor(
                                                                item.sale_item_id,
                                                                e.target.value,
                                                                remaining,
                                                            )
                                                        }
                                                        className="text-right"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {items.length === 0 && (
                                    <p className="py-6 text-center text-sm text-muted-foreground">
                                        No items on this sale.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="void_reason">Reason</Label>
                                <textarea
                                    id="void_reason"
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Why is this being voided/returned?"
                                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="void_received_by">
                                    Received By (optional)
                                </Label>
                                <Input
                                    id="void_received_by"
                                    value={receivedBy}
                                    onChange={(e) =>
                                        setReceivedBy(e.target.value)
                                    }
                                    placeholder="Defaults to your account name"
                                />
                            </div>

                            {selectedLines.length > 0 && (
                                <div className="rounded-md bg-muted/50 p-3 text-sm">
                                    <p className="font-medium">
                                        {selectedLines.length} line
                                        {selectedLines.length > 1
                                            ? "s"
                                            : ""}{" "}
                                        selected for return
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!canSubmit}>
                            <Undo2 className="mr-2 h-4 w-4" />
                            {submitting ? "Processing..." : "Process Return"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
