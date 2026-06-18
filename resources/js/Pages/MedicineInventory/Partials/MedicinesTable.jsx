import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/Components/ui/card";
import { router, useForm } from "@inertiajs/react";
import { PackagePlus, Pencil, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import EditModal from "./EditModal";
import AddStockModal from "./AddStockModal";

export default function MedicinesTable({
    medicines,
    branches,
    userBranchId,
    filters,
}) {
    const { delete: destroy } = useForm();

    const goToPage = (page) => {
        router.get(
            route("medicine-inventory.index"),
            { ...filters, page },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["medicines"],
            },
        );
    };

    const handleSearch = (search) => {
        router.get(
            route("medicine-inventory.index"),
            { ...filters, search, page: 1 },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["medicines", "filters"],
            },
        );
    };

    const handleStatusFilter = (status) => {
        router.get(
            route("medicine-inventory.index"),
            { ...filters, status, page: 1 },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["medicines", "filters"],
            },
        );
    };

    const handleDelete = (medicine) => {
        Swal.fire({
            title: "Deactivate Medicine?",
            text: `"${medicine.med_name}" will be marked as Deleted. Stock records will be set to Inactive. Sales history is preserved.`,
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

    const formatPrice = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num.toFixed(2) : "0.00";
    };

    const statusBadgeClass = (status) => {
        if (status === "Active") return "bg-green-100 text-green-800";
        if (status === "Inactive") return "bg-yellow-100 text-yellow-800";
        return "bg-red-100 text-red-800";
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                        placeholder="Search medicines..."
                        defaultValue={filters?.search || ""}
                        className="max-w-sm"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleSearch(e.target.value);
                            }
                        }}
                    />
                    <select
                        className="flex h-10 w-full max-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={filters?.status || "Active"}
                        onChange={(e) => handleStatusFilter(e.target.value)}
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Deleted">Deleted</option>
                        <option value="all">All Statuses</option>
                    </select>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Dose / Form</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Pack Size</TableHead>
                                <TableHead>Retail (pc)</TableHead>
                                <TableHead>Wholesale (box)</TableHead>
                                <TableHead>Total Stock (pcs)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {medicines.data.length ? (
                                medicines.data.map((medicine) => (
                                    <TableRow key={medicine.id}>
                                        <TableCell className="font-medium">
                                            {medicine.med_name}
                                        </TableCell>
                                        <TableCell>
                                            {[medicine.dose, medicine.form]
                                                .filter(Boolean)
                                                .join(" / ") || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {medicine.brand_name || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {medicine.pack_size}
                                        </TableCell>
                                        <TableCell>
                                            {formatPrice(medicine.retail_price)}
                                        </TableCell>
                                        <TableCell>
                                            {formatPrice(
                                                medicine.wholesale_price,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {medicine.total_quantity ?? 0}
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(medicine.status)}`}
                                            >
                                                {medicine.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {medicine.status ===
                                                    "Active" && (
                                                    <AddStockModal
                                                        medicine={medicine}
                                                        branches={branches}
                                                        userBranchId={
                                                            userBranchId
                                                        }
                                                    >
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="flex items-center gap-1"
                                                        >
                                                            <PackagePlus className="h-3.5 w-3.5" />
                                                            Stock
                                                        </Button>
                                                    </AddStockModal>
                                                )}
                                                {medicine.status ===
                                                    "Active" && (
                                                    <EditModal
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
                                                    </EditModal>
                                                )}
                                                {medicine.status ===
                                                    "Active" && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                        onClick={() =>
                                                            handleDelete(
                                                                medicine,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={9}
                                        className="h-24 text-center"
                                    >
                                        No medicines found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                        Showing {medicines.from ?? 0} to {medicines.to ?? 0} of{" "}
                        {medicines.total ?? 0} medicines
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                goToPage(medicines.current_page - 1)
                            }
                            disabled={medicines.current_page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {medicines.current_page} of{" "}
                            {medicines.last_page}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                goToPage(medicines.current_page + 1)
                            }
                            disabled={
                                medicines.current_page >= medicines.last_page
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
