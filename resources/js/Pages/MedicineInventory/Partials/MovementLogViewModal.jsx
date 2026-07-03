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
import {
    formatMovementQuantity,
    getMovementTypeLabel,
} from "../lib/movementLogLabels";

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

const formatDetailValue = (field, value) => {
    if (value === null || value === undefined || value === "—") {
        return "—";
    }

    if (field === "retail_price" || field === "wholesale_price") {
        const amount = Number(value);
        if (!Number.isNaN(amount)) {
            return `₱${amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
        }
    }

    return String(value);
};

export default function MovementLogViewModal({ logId, children }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);

    const openModal = async () => {
        if (!logId) {
            toast.error("Movement log ID not found");
            return;
        }

        setOpen(true);
        setLoading(true);

        try {
            const response = await axios.get(route("movement-logs.show", logId));
            setDetails(response.data);
        } catch {
            toast.error("Failed to load movement log details");
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const log = details?.log;
    const changes = log?.metadata?.changes ?? [];
    const snapshot = log?.metadata?.snapshot ?? [];

    return (
        <>
            <div onClick={openModal}>{children}</div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Movement Log #{log?.log_id ?? logId}
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            Loading movement log details...
                        </div>
                    ) : log ? (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <span className="text-muted-foreground">
                                        Type:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {getMovementTypeLabel(
                                            log.movement_type,
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Date:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {formatDateTime(log.created_at)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Reference:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {log.reference_label}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Medicine:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {log.medicine_name}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Lot:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {log.lot_number || "—"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        Quantity:
                                    </span>{" "}
                                    <span
                                        className={`font-medium ${
                                            log.quantity > 0
                                                ? "text-green-700"
                                                : log.quantity < 0
                                                  ? "text-red-700"
                                                  : ""
                                        }`}
                                    >
                                        {formatMovementQuantity(log.quantity)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">
                                        User:
                                    </span>{" "}
                                    <span className="font-medium">
                                        {log.performer?.name ?? "—"}
                                    </span>
                                </div>
                                {log.performer?.email && (
                                    <div>
                                        <span className="text-muted-foreground">
                                            Email:
                                        </span>{" "}
                                        <span className="font-medium">
                                            {log.performer.email}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {changes.length > 0 && (
                                <div className="rounded-md border">
                                    <p className="border-b bg-muted/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Changes
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Field</TableHead>
                                                <TableHead>Before</TableHead>
                                                <TableHead>After</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {changes.map((change) => (
                                                <TableRow
                                                    key={change.field}
                                                >
                                                    <TableCell className="font-medium">
                                                        {change.label}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDetailValue(
                                                            change.field,
                                                            change.old,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDetailValue(
                                                            change.field,
                                                            change.new,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {snapshot.length > 0 && (
                                <div className="rounded-md border">
                                    <p className="border-b bg-muted/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Recorded Details
                                    </p>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Field</TableHead>
                                                <TableHead>Value</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {snapshot.map((item) => (
                                                <TableRow key={item.field}>
                                                    <TableCell className="font-medium">
                                                        {item.label}
                                                    </TableCell>
                                                    <TableCell>
                                                        {formatDetailValue(
                                                            item.field,
                                                            item.value,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {log.product && (
                                <div className="rounded-md border bg-muted/20 p-3">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Current Medicine
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-muted-foreground">
                                                Brand:
                                            </span>{" "}
                                            {log.product.brand_name || "—"}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Dose:
                                            </span>{" "}
                                            {log.product.dose || "—"}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Form:
                                            </span>{" "}
                                            {log.product.form || "—"}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Pack Size:
                                            </span>{" "}
                                            {log.product.pack_size ?? "—"}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Retail Price:
                                            </span>{" "}
                                            {formatDetailValue(
                                                "retail_price",
                                                log.product.retail_price,
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Wholesale Price:
                                            </span>{" "}
                                            {formatDetailValue(
                                                "wholesale_price",
                                                log.product.wholesale_price,
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Status:
                                            </span>{" "}
                                            {log.product.status || "—"}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {log.remarks && (
                                <div>
                                    <span className="text-muted-foreground">
                                        Remarks:
                                    </span>
                                    <p className="mt-1 font-medium">
                                        {log.remarks}
                                    </p>
                                </div>
                            )}

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
