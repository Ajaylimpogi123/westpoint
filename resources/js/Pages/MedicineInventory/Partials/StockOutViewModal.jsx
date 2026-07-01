import { useState } from "react";
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

const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function StockOutViewModal({ stockOutId, children }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);

    const openModal = async () => {
        if (!stockOutId) {
            toast.error("Stock-out ID not found");
            return;
        }

        setOpen(true);
        setLoading(true);

        try {
            const response = await axios.get(
                route("stock-out.show", stockOutId),
            );
            setDetails(response.data);
        } catch {
            toast.error("Failed to load stock-out details");
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Stock Out #
                            {details?.stock_out?.stock_out_id ?? stockOutId}
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading stock-out details...
                        </div>
                    ) : details ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <span className="text-muted-foreground">
                                        Subtype:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {
                                            details.stock_out
                                                .transaction_subtype
                                        }
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Issued By:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.stock_out.issued_by}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Patient / Reference:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.stock_out.patient_reference ||
                                            "—"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Recorded:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDateTime(
                                            details.stock_out.created_at,
                                        )}
                                    </span>
                                </div>
                                {details.stock_out.remarks && (
                                    <div className="sm:col-span-2">
                                        <span className="text-muted-foreground">
                                            Remarks:
                                        </span>{" "}
                                        <span className="font-medium">
                                            {details.stock_out.remarks}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Medicine Name</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead>Lot</TableHead>
                                            <TableHead>Qty Deducted</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {details.items?.length ? (
                                            details.items.map((item) => (
                                                <TableRow key={item.item_id}>
                                                    <TableCell>
                                                        {item.product?.med_name ||
                                                            "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.product
                                                            ?.brand_name || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.lot_number || "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.quantity_deducted}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="text-center"
                                                >
                                                    No items found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
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
