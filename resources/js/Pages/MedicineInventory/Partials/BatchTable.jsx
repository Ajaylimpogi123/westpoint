import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useForm } from "@inertiajs/react";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import AddStockModal from "./AddStockModal";
import EditBatchModal from "./EditBatchModal";
import StockStatusBadge from "./StockStatusBadge";
import { getBatchStockStatus } from "../lib/stockStatus";

export default function BatchTable({ medicine, batches, canEditMedicine = false }) {
    const { delete: destroy } = useForm();

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString();
    };

    const handleDeleteBatch = (batch) => {
        Swal.fire({
            title: "Remove Batch?",
            text: `Lot "${batch.lot_number || batch.id}" will be marked as Deleted.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Remove",
        }).then((result) => {
            if (result.isConfirmed) {
                destroy(route("medicine-inventory.destroy-batch", batch.id), {
                    preserveScroll: true,
                    only: ["medicines"],
                });
            }
        });
    };

    return (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                    Branch Batches — {medicine.med_name}
                </h4>
                {medicine.status === "Active" && (
                    <AddStockModal medicine={medicine}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                        >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Add Stock
                        </Button>
                    </AddStockModal>
                )}
            </div>

            <div className="rounded-md border bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Lot Number</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead>Shelf Number</TableHead>
                            <TableHead>Batch Pieces</TableHead>
                            <TableHead>Stock Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {batches?.length ? (
                            batches.map((batch) => {
                                const batchStatus = getBatchStockStatus(
                                    batch.quantity,
                                    batch.expiry,
                                );

                                return (
                                <TableRow key={batch.id}>
                                    <TableCell>
                                        {batch.lot_number || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(batch.expiry)}
                                    </TableCell>
                                    <TableCell>
                                        {batch.shelf_number || "-"}
                                    </TableCell>
                                    <TableCell>{batch.quantity}</TableCell>
                                    <TableCell>
                                        <StockStatusBadge status={batchStatus} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canEditMedicine && (
                                            <div className="flex items-center justify-end gap-2">
                                                <EditBatchModal
                                                    batch={batch}
                                                    medicine={medicine}
                                                >
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </Button>
                                                </EditBatchModal>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                    onClick={() =>
                                                        handleDeleteBatch(batch)
                                                    }
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="h-16 text-center text-sm text-muted-foreground"
                                >
                                    No batches for this branch yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
