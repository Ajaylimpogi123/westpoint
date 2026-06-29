import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { useForm } from "@inertiajs/react";
import {
    ChevronDown,
    ChevronRight,
    Pencil,
    Trash2,
} from "lucide-react";
import Swal from "sweetalert2";
import EditModal from "./EditModal";
import BatchTable from "./BatchTable";
import StockStatusBadge from "./StockStatusBadge";
import { getMedicineStockStatus } from "../lib/stockStatus";

const COLUMN_COUNT = 8;

export default function MedicineRow({
    medicine,
    isExpanded,
    onToggle,
    canEditMedicine = false,
}) {
    const { delete: destroy } = useForm();

    const stockStatus = getMedicineStockStatus(
        medicine.total_stock,
        medicine.pack_size,
    );

    const formatPrice = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num.toFixed(2) : "0.00";
    };

    const handleDelete = () => {
        Swal.fire({
            title: "Deactivate Medicine?",
            text: `"${medicine.med_name}" will be marked as Deleted. Branch stock records will be set to Inactive.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Deactivate",
        }).then((result) => {
            if (result.isConfirmed) {
                destroy(route("medicine-inventory.destroy", medicine.id), {
                    preserveScroll: true,
                    only: ["medicines"],
                });
            }
        });
    };

    return (
        <Fragment>
            <TableRow className="cursor-pointer hover:bg-muted/50">
                <TableCell className="w-10">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={onToggle}
                        aria-expanded={isExpanded}
                        aria-label={
                            isExpanded ? "Collapse batches" : "Expand batches"
                        }
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>
                </TableCell>
                <TableCell
                    className="font-medium"
                    onClick={onToggle}
                >
                    {medicine.med_name}
                </TableCell>
                <TableCell onClick={onToggle}>
                    {medicine.brand_name || "-"}
                </TableCell>
                <TableCell onClick={onToggle}>
                    {medicine.dose || "-"}
                </TableCell>
                <TableCell onClick={onToggle}>
                    {medicine.form || "-"}
                </TableCell>
                <TableCell onClick={onToggle}>
                    {formatPrice(medicine.retail_price)}
                </TableCell>
                <TableCell onClick={onToggle}>
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span>{medicine.total_stock ?? 0}</span>
                        <StockStatusBadge status={stockStatus} />
                    </div>
                </TableCell>
                <TableCell className="text-right">
                    {medicine.status === "Active" && (
                        <div className="flex items-center justify-end gap-2">
                            {canEditMedicine && (
                                <EditModal medicine={medicine}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="flex items-center gap-1"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                </EditModal>
                            )}
                            {canEditMedicine && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete();
                                    }}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </Button>
                            )}
                        </div>
                    )}
                </TableCell>
            </TableRow>

            {isExpanded && (
                <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="p-0">
                        <BatchTable
                            medicine={medicine}
                            batches={medicine.batches}
                            canEditMedicine={canEditMedicine}
                        />
                    </TableCell>
                </TableRow>
            )}
        </Fragment>
    );
}
