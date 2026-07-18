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

const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
};

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

export default function StockInViewModal({ stockInId, children }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);

    const openModal = async () => {
        if (!stockInId) {
            toast.error("Stock-in ID not found");
            return;
        }

        setOpen(true);
        setLoading(true);

        try {
            const response = await axios.get(route("stock-in.show", stockInId));
            setDetails(response.data);
        } catch {
            toast.error("Failed to load stock-in details");
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
                            Stock In #{details?.stock_in?.stock_in_id ?? stockInId}
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading stock-in details...
                        </div>
                    ) : details ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <span className="text-muted-foreground">
                                        Supplier:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.stock_in.supplier_name}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Delivery Date:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDate(
                                            details.stock_in.delivery_date,
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Received By:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.stock_in.received_by}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Recorded:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDateTime(
                                            details.stock_in.created_at,
                                        )}
                                    </span>
                                </div>
                                {details.stock_in.remarks && (
                                    <div className="sm:col-span-2">
                                        <span className="text-muted-foreground">
                                            Remarks:
                                        </span>{" "}
                                        <span className="font-medium">
                                            {details.stock_in.remarks}
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
                                            <TableHead>Expiry</TableHead>
                                            <TableHead>Unit Type</TableHead>
                                            <TableHead>Qty</TableHead>
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
                                                        {item.batch_number ||
                                                            "-"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDate(
                                                            item.expiry_date,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.unit_type ===
                                                        "Box"
                                                            ? "Box"
                                                            : "Piece"}
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.quantity_received}
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

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    className="flex items-center gap-1"
                                    onClick={() =>
                                        window.open(
                                            route(
                                                "stock-in.receipt",
                                                details.stock_in.stock_in_id,
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
