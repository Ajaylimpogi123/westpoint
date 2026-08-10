import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { formatDate, formatDateTime } from "@/lib/dates";

export default function CustomerReturnViewModal({ returnId, children }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);

    const openModal = async () => {
        if (!returnId) {
            toast.error("Return ID not found");
            return;
        }

        setOpen(true);
        setLoading(true);

        try {
            const response = await axios.get(
                route("customer-return.show", returnId),
            );
            setDetails(response.data);
        } catch {
            toast.error("Failed to load return details");
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
                            Return #
                            {details?.customer_return?.return_id ?? returnId}
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading return details...
                        </div>
                    ) : details ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <span className="text-muted-foreground">
                                        Customer:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.customer_return.customer
                                            ?.name || "—"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Return Date:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDate(
                                            details.customer_return.return_date,
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Received By:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {details.customer_return.received_by}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Recorded:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDateTime(
                                            details.customer_return.created_at,
                                        )}
                                    </span>
                                </div>
                                {details.customer_return.remarks && (
                                    <div className="sm:col-span-2">
                                        <span className="text-muted-foreground">
                                            Remarks:
                                        </span>{" "}
                                        <span className="font-medium">
                                            {details.customer_return.remarks}
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
                                                        {item.product
                                                            ?.med_name || "-"}
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
                                                        "box"
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
                                                "customer-return.receipt",
                                                details.customer_return
                                                    .return_id,
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
