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

const formatCurrency = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const productLabel = (product) => {
    if (!product) return "Product";
    const parts = [product.med_name, product.dose, product.form, product.brand_name]
        .filter(Boolean)
        .join(" ");
    return parts || "Product";
};

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
                                        {formatDate(details.sale.created_at)}
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
                                    <span className="font-medium uppercase">
                                        {details.sale.payment_method}
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Unit</TableHead>
                                            <TableHead>Qty</TableHead>
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
                                                    colSpan={5}
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
                                <div className="flex justify-between font-semibold text-green-600">
                                    <span>Net Amount</span>
                                    <span>
                                        {formatCurrency(
                                            details.sale.net_amount,
                                        )}
                                    </span>
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
