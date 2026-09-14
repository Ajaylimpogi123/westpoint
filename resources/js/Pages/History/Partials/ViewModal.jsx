import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { formatPaymentMethod } from "../lib/historyHelpers";

const formatCurrency = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const productLabel = (product) => {
    if (!product) return "Product";
    const parts = [
        product.med_name,
        product.dose,
        product.form,
        product.brand_name,
    ]
        .filter(Boolean)
        .join(" ");
    return parts || "Product";
};

function StatusBadge({ status }) {
    const normalized = status || "Completed";
    const styles = {
        Completed: "bg-green-100 text-green-700",
        "Partially Voided": "bg-amber-100 text-amber-700",
        Voided: "bg-red-100 text-red-700",
    };

    return (
        <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                styles[normalized] || "bg-muted text-muted-foreground"
            }`}
        >
            {normalized}
        </span>
    );
}

export default function ViewModal({ saleId, children }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);

    const openModal = async () => {
        if (!saleId) {
            toast.error("Sale ID not found");
            return;
        }

        setOpen(true);
        setLoading(true);

        try {
            const response = await axios.get(route("history.show", saleId));
            setDetails(response.data);
        } catch {
            toast.error("Failed to load sale details");
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const customerName =
        details?.sale?.customer_name &&
        String(details.sale.customer_name).trim() !== ""
            ? details.sale.customer_name
            : "Walk-in";

    const refundedAmount = Number(details?.sale?.refunded_amount) || 0;
    const originalNetAmount = Number(details?.sale?.net_amount) || 0;
    const amountDue = Math.max(originalNetAmount - refundedAmount, 0);
    const hasRemarks =
        details?.sale?.sales_remarks &&
        String(details.sale.sales_remarks).trim() !== "";

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Sale Details</DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading sale details...
                        </div>
                    ) : details ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">
                                        Invoice Number:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.sale.invoice_number}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Date:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDateTime(
                                            details.sale.created_at,
                                            "",
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Customer:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {customerName}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Payment:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatPaymentMethod(
                                            details.sale.payment_method,
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Status:
                                    </span>{" "}
                                    <StatusBadge status={details.sale.status} />
                                </div>
                                {details.sale.reference_number &&
                                    String(
                                        details.sale.reference_number,
                                    ).trim() !== "" && (
                                        <div>
                                            <span className="text-muted-foreground">
                                                Reference Number:
                                            </span>{" "}
                                            <span className="font-medium">
                                                {details.sale.reference_number}
                                            </span>
                                        </div>
                                    )}
                            </div>

                            {hasRemarks && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                                    <span className="font-medium text-amber-900">
                                        Remarks:
                                    </span>{" "}
                                    <span className="text-amber-800">
                                        {details.sale.sales_remarks}
                                    </span>
                                </div>
                            )}

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Returned</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {details.items?.length ? (
                                            details.items.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        {productLabel(
                                                            item.product,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.unit_type}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.quantity_sold}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.returned_quantity >
                                                        0 ? (
                                                            <span className="text-amber-700">
                                                                {
                                                                    item.returned_quantity
                                                                }
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatCurrency(
                                                            item.price_used,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatCurrency(
                                                            item.total_price,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={6}
                                                    className="text-center"
                                                >
                                                    No items found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span>Gross Amount</span>
                                    <span>
                                        {formatCurrency(
                                            details.sale.gross_amount,
                                        )}
                                    </span>
                                </div>
                                {Number(details.sale.discount_amount) > 0 && (
                                    <div className="flex justify-between">
                                        <span>Discount</span>
                                        <span>
                                            -
                                            {formatCurrency(
                                                details.sale.discount_amount,
                                            )}
                                        </span>
                                    </div>
                                )}
                                {refundedAmount > 0 && (
                                    <>
                                        <div className="flex justify-between text-muted-foreground line-through">
                                            <span>Original Net Amount</span>
                                            <span>
                                                {formatCurrency(
                                                    originalNetAmount,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-amber-700">
                                            <span>Refunded / Voided</span>
                                            <span>
                                                -
                                                {formatCurrency(refundedAmount)}
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between font-semibold text-green-600">
                                    <span>
                                        {refundedAmount > 0
                                            ? "Amount Due"
                                            : "Net Amount"}
                                    </span>
                                    <span>{formatCurrency(amountDue)}</span>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}
