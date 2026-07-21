import { memo, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
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
import { Loader2, Pill, Search, SlidersHorizontal, X } from "lucide-react";
import MedicineRow from "./MedicineRow";
import { MEDICINE_FORMS } from "../lib/medicineForms";

const DEFAULT_STATUS = "Active";
const DEFAULT_STOCK_LEVEL = "all";

function MedicinesTable({ medicines, filters, branchId, canEditMedicine }) {
    const [expandedRows, setExpandedRows] = useState({});
    const [search, setSearch] = useState(filters?.search || "");
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(false);

    const status = filters?.status || DEFAULT_STATUS;
    const stockLevel = filters?.stock_level || DEFAULT_STOCK_LEVEL;
    const form = filters?.form || "";
    const genericOnly = Boolean(filters?.generic_only) &&
        filters?.generic_only !== "0" &&
        filters?.generic_only !== "false";

    const activeFilterCount = [
        status !== DEFAULT_STATUS,
        stockLevel !== DEFAULT_STOCK_LEVEL,
        form !== "",
        genericOnly,
    ].filter(Boolean).length;

    const toggleRow = useCallback((id) => {
        setExpandedRows((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    }, []);

    const runFilterRequest = useCallback(
        (params) => {
            setLoading(true);
            router.get(
                route("medicine-inventory.index"),
                { ...filters, search, ...params },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    only: ["medicines", "filters"],
                    onFinish: () => setLoading(false),
                },
            );
        },
        [filters, search],
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

    const executeSearch = useCallback(
        () => runFilterRequest({ page: 1 }),
        [runFilterRequest],
    );

    const handleStatusFilter = useCallback(
        (value) => runFilterRequest({ status: value, page: 1 }),
        [runFilterRequest],
    );

    const handleStockLevelFilter = useCallback(
        (value) => runFilterRequest({ stock_level: value, page: 1 }),
        [runFilterRequest],
    );

    const handleFormFilter = useCallback(
        (value) => runFilterRequest({ form: value, page: 1 }),
        [runFilterRequest],
    );

    const handleGenericOnlyFilter = useCallback(
        (pressed) => runFilterRequest({ generic_only: pressed ? 1 : 0, page: 1 }),
        [runFilterRequest],
    );

    const clearFilters = useCallback(() => {
        runFilterRequest({
            status: DEFAULT_STATUS,
            stock_level: DEFAULT_STOCK_LEVEL,
            form: "",
            generic_only: 0,
            page: 1,
        });
    }, [runFilterRequest]);

    const handleSearchChange = useCallback((e) => {
        setSearch(e.target.value);
    }, []);

    const handleSearchKeyDown = useCallback(
        (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                executeSearch();
            }
        },
        [executeSearch],
    );

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

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search medicines by name, brand, dose, or form..."
                            className="pl-9"
                        />
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowFilters((prev) => !prev)}
                        className="shrink-0 gap-1.5"
                        aria-pressed={showFilters}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge
                                variant="secondary"
                                className="ml-0.5 h-5 min-w-5 rounded-full px-1 text-xs"
                            >
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>

                    <Button type="button" onClick={executeSearch} disabled={loading}>
                        {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Search className="mr-2 h-4 w-4" />
                        )}
                        Search
                    </Button>
                </div>

                {showFilters && (
                    <Card className="border-dashed">
                        <CardContent className="p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">
                                    Filters
                                </p>
                                {activeFilterCount > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                        Clear all
                                    </Button>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Medicine Status
                                    </Label>
                                    <Select
                                        value={status}
                                        onValueChange={handleStatusFilter}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Active" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Active">
                                                Active
                                            </SelectItem>
                                            <SelectItem value="Inactive">
                                                Inactive
                                            </SelectItem>
                                            <SelectItem value="Deleted">
                                                Deleted
                                            </SelectItem>
                                            <SelectItem value="all">
                                                All Status
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Stock Level
                                    </Label>
                                    <Select
                                        value={stockLevel}
                                        onValueChange={handleStockLevelFilter}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="All Stock Levels" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">
                                                All Stock Levels
                                            </SelectItem>
                                            <SelectItem value="out_of_stock">
                                                Out of Stock
                                            </SelectItem>
                                            <SelectItem value="low_stock">
                                                Low Stock
                                            </SelectItem>
                                            <SelectItem value="in_stock">
                                                In Stock
                                            </SelectItem>
                                            <SelectItem value="has_expired">
                                                Has Expired Batches
                                            </SelectItem>
                                            <SelectItem value="expiring_soon">
                                                Expiring Soon (30 days)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Form
                                    </Label>
                                    <Select
                                        value={form || "__all__"}
                                        onValueChange={(value) =>
                                            handleFormFilter(
                                                value === "__all__" ? "" : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="All forms" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">
                                                All forms
                                            </SelectItem>
                                            {MEDICINE_FORMS.map((formOption) => (
                                                <SelectItem
                                                    key={formOption}
                                                    value={formOption}
                                                >
                                                    {formOption}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">
                                        Quick filters
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        <Toggle
                                            variant="outline"
                                            size="sm"
                                            pressed={genericOnly}
                                            onPressedChange={handleGenericOnlyFilter}
                                            className="h-9 gap-1.5 text-xs"
                                            aria-label="Generic Only"
                                        >
                                            <Pill className="h-3.5 w-3.5" />
                                            Generic Only
                                        </Toggle>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

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
