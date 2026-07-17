import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const SEARCH_DEBOUNCE_MS = 300;

function MedicinesTable({ medicines, filters, branchId, canEditMedicine }) {
    const [expandedRows, setExpandedRows] = useState({});
    const [search, setSearch] = useState(filters?.search || "");

    const isFirstRender = useRef(true);
    const debounceTimer = useRef(null);

    const toggleRow = useCallback((id) => {
        setExpandedRows((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    }, []);

    const runFilterRequest = useCallback(
        (params) => {
            router.get(
                route("medicine-inventory.index"),
                { ...filters, ...params },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    only: ["medicines", "filters"],
                },
            );
        },
        [filters],
    );

    const goToPage = useCallback(
        (page) => {
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
        },
        [filters],
    );

    const handleStatusFilter = useCallback(
        (status) => runFilterRequest({ status, page: 1 }),
        [runFilterRequest],
    );

    const handleStockLevelFilter = useCallback(
        (stock_level) => runFilterRequest({ stock_level, page: 1 }),
        [runFilterRequest],
    );

    const handleSearchChange = useCallback((e) => {
        setSearch(e.target.value);
    }, []);

    // Debounce search-as-you-type — fires SEARCH_DEBOUNCE_MS after the
    // user stops typing, instead of on every keystroke or Enter press.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            runFilterRequest({ search, page: 1 });
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // Memoize the row list so it only rebuilds when the underlying
    // medicines data or the expanded/edit state actually changes —
    // not on every parent re-render (e.g. while typing in the search box).
    const rows = useMemo(() => {
        return medicines.data.map((medicine) => (
            <MedicineRow
                key={medicine.id}
                medicine={medicine}
                isExpanded={!!expandedRows[medicine.id]}
                onToggle={() => toggleRow(medicine.id)}
                canEditMedicine={canEditMedicine}
            />
        ));
    }, [medicines.data, expandedRows, toggleRow, canEditMedicine]);

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {!branchId && (
                    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                        No branch is assigned to your session. Inventory data is
                        hidden until a branch is linked to your account.
                    </div>
                )}

                {branchId && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                        Empty or deactivated lots are hidden from the batch
                        breakdown. Lots that reach zero stock are automatically
                        marked inactive.
                    </div>
                )}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <Input
                        placeholder="Search medicines..."
                        value={search}
                        onChange={handleSearchChange}
                        className="max-w-sm"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor="medicine-status-filter"
                                className="text-xs font-medium text-muted-foreground"
                            >
                                Medicine Status
                            </label>
                            <select
                                id="medicine-status-filter"
                                className="flex h-10 w-full min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={filters?.status || "Active"}
                                onChange={(e) =>
                                    handleStatusFilter(e.target.value)
                                }
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Deleted">Deleted</option>
                                <option value="all">All Status</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor="stock-level-filter"
                                className="text-xs font-medium text-muted-foreground"
                            >
                                Stock Level
                            </label>
                            <select
                                id="stock-level-filter"
                                className="flex h-10 w-full min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={filters?.stock_level || "all"}
                                onChange={(e) =>
                                    handleStockLevelFilter(e.target.value)
                                }
                            >
                                <option value="all">All Stock Levels</option>
                                <option value="out_of_stock">
                                    Out of Stock
                                </option>
                                <option value="low_stock">Low Stock</option>
                                <option value="in_stock">In Stock</option>
                                <option value="has_expired">
                                    Has Expired Batches
                                </option>
                                <option value="expiring_soon">
                                    Expiring Soon (30 days)
                                </option>
                            </select>
                        </div>
                    </div>
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
                                <TableHead>Pack Size</TableHead>
                                <TableHead>Price (pc)</TableHead>
                                <TableHead>Branch Stock (pcs)</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {medicines.data.length ? (
                                rows
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
                            onClick={() => goToPage(medicines.current_page - 1)}
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
                            onClick={() => goToPage(medicines.current_page + 1)}
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

export default memo(MedicinesTable);
