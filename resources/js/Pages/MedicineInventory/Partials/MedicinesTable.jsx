import { useState } from "react";
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
import { router } from "@inertiajs/react";
import MedicineRow from "./MedicineRow";

export default function MedicinesTable({ medicines, filters, branchId }) {
    const [expandedRows, setExpandedRows] = useState({});

    const toggleRow = (id) => {
        setExpandedRows((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

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

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {!branchId && (
                    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                        No branch is assigned to your session. Inventory data
                        is hidden until a branch is linked to your account.
                    </div>
                )}

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
                                <TableHead className="w-10" />
                                <TableHead>Medicine</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Dose</TableHead>
                                <TableHead>Form</TableHead>
                                <TableHead>Price (pc)</TableHead>
                                <TableHead>Branch Stock (pcs)</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {medicines.data.length ? (
                                medicines.data.map((medicine) => (
                                    <MedicineRow
                                        key={medicine.id}
                                        medicine={medicine}
                                        isExpanded={!!expandedRows[medicine.id]}
                                        onToggle={() => toggleRow(medicine.id)}
                                    />
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
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
