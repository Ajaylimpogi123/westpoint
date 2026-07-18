import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Printer } from "lucide-react";
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
                                        Delivered To:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.stock_out.delivered_to ||
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
                                            <TableHead>Unit Type</TableHead>
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
                                                        {item.unit_type ===
                                                        "box"
                                                            ? "Box"
                                                            : "Piece"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.quantity_deducted}
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

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    className="flex items-center gap-1"
                                    onClick={() =>
                                        window.open(
                                            route(
                                                "stock-out.receipt",
                                                details.stock_out
                                                    .stock_out_id,
                                            ),
                                            "_blank",
                                            "noopener,noreferrer",
                                        )
                                    }
                                >
                                    <Printer className="h-3.5 w-3.5" />
                                    Print Receipt
                                </Button>
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
