import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { calculateAmount } from "../lib/quotationItems";
import { formatCurrency } from "../lib/quotationStatus";

const EMPTY_ERRORS = {};
const ITEMS_PER_PAGE = 10;

// One row, memoized. As long as `item` keeps the same object reference
// (i.e. the parent's updateItem only replaces the row that actually
// changed, not the whole array) and `updateItem`/`removeItem` are stable
// (wrapped in useCallback in the parent), editing one row will not
// re-render any of the others — this is what keeps a few hundred rows
// fast to type into.
const ItemRow = memo(function ItemRow({
    item,
    index,
    rowErrors,
    updateItem,
    removeItem,
    canRemove,
}) {
    const handleChange = useCallback(
        (field) => (e) => updateItem(index, field, e.target.value),
        [updateItem, index],
    );

    const handleRemove = useCallback(
        () => removeItem(index),
        [removeItem, index],
    );

    const amount = useMemo(
        () => calculateAmount(item),
        [item.qt_qty, item.qt_unit_price],
    );

    return (
        <TableRow>
            <TableCell className="align-top">
                <Input
                    type="number"
                    min="1"
                    value={item.qt_qty}
                    onChange={handleChange("qt_qty")}
                    className="w-16"
                />
                {rowErrors.qt_qty && (
                    <p className="mt-1 text-xs text-red-500">
                        {rowErrors.qt_qty}
                    </p>
                )}
            </TableCell>
            <TableCell className="align-top">
                <Input
                    type="text"
                    value={item.qt_unit ?? ""}
                    onChange={handleChange("qt_unit")}
                    placeholder="BXS"
                    className="w-24"
                />
            </TableCell>
            <TableCell className="min-w-[220px] align-top">
                <Input
                    type="text"
                    value={item.qt_description}
                    onChange={handleChange("qt_description")}
                    placeholder="Item description"
                />
                {rowErrors.qt_description && (
                    <p className="mt-1 text-xs text-red-500">
                        {rowErrors.qt_description}
                    </p>
                )}
            </TableCell>
            <TableCell className="align-top">
                <Input
                    type="text"
                    value={item.lot_number ?? ""}
                    onChange={handleChange("lot_number")}
                    className="w-32"
                />
            </TableCell>
            <TableCell className="align-top">
                <Input
                    type="date"
                    value={item.expiry_date ?? ""}
                    onChange={handleChange("expiry_date")}
                    className="w-36"
                />
            </TableCell>
            <TableCell className="align-top">
                <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.qt_unit_price}
                    onChange={handleChange("qt_unit_price")}
                    className="w-28 text-right"
                />
                {rowErrors.qt_unit_price && (
                    <p className="mt-1 text-xs text-red-500">
                        {rowErrors.qt_unit_price}
                    </p>
                )}
            </TableCell>
            <TableCell className="text-right align-top font-medium text-slate-700">
                {formatCurrency(amount)}
            </TableCell>
            <TableCell className="text-center align-top">
                <button
                    type="button"
                    onClick={handleRemove}
                    disabled={!canRemove}
                    className="text-slate-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    title="Remove row"
                >
                    <X className="h-4 w-4" />
                </button>
            </TableCell>
        </TableRow>
    );
});

export default function ItemsTable({
    items,
    errors = {},
    updateItem,
    addItem,
    removeItem,
    total,
}) {
    // Split "items.3.qt_qty": "..." style Inertia errors into
    // { 3: { qt_qty: "..." } } once per render, instead of re-scanning
    // the whole errors object inside every single row.
    const errorsByIndex = useMemo(() => {
        const map = {};
        for (const key in errors) {
            const match = key.match(/^items\.(\d+)\.(.+)$/);
            if (!match) continue;
            const [, idx, field] = match;
            (map[idx] ??= {})[field] = errors[key];
        }
        return map;
    }, [errors]);

    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));

    // If rows get removed and the current page no longer exists (e.g. you
    // were on page 3 and deleted your way down to 1 page), snap back to
    // the last valid page instead of showing an empty table.
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const visibleItems = items
        .slice(startIndex, startIndex + ITEMS_PER_PAGE)
        .map((item, i) => ({ item, index: startIndex + i }));

    // New rows are appended to the end of `items` by the parent — jump to
    // whichever page that lands on so the row you just added is visible.
    function handleAddItem() {
        addItem();
        setPage(Math.ceil((items.length + 1) / ITEMS_PER_PAGE));
    }

    return (
        <div>
            <Card className="overflow-hidden py-0">
                <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-16">Qty</TableHead>
                                <TableHead className="w-24">Unit</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-32">Lot No.</TableHead>
                                <TableHead className="w-36">Expiry</TableHead>
                                <TableHead className="w-28">
                                    Unit Price
                                </TableHead>
                                <TableHead className="w-32 text-right">
                                    Amount
                                </TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleItems.map(({ item, index }) => (
                                <ItemRow
                                    // Prefer a stable id over the array index as the key.
                                    // If `addItem` in the parent doesn't already stamp new
                                    // rows with one, give each new item a client-side id
                                    // (e.g. crypto.randomUUID()) — otherwise removing a
                                    // row in the middle reshuffles every key below it and
                                    // React ends up reusing the wrong row's DOM/input state.
                                    key={item.id ?? index}
                                    item={item}
                                    index={index}
                                    rowErrors={
                                        errorsByIndex[index] ?? EMPTY_ERRORS
                                    }
                                    updateItem={updateItem}
                                    removeItem={removeItem}
                                    canRemove={items.length > 1}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {items.length > ITEMS_PER_PAGE && (
                <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                    <span>
                        Showing {startIndex + 1}–
                        {Math.min(startIndex + ITEMS_PER_PAGE, items.length)} of{" "}
                        {items.length} items
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="gap-1 disabled:opacity-40"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Prev
                        </Button>
                        <span className="px-2">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={page === totalPages}
                            className="gap-1 disabled:opacity-40"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="mt-3 flex items-center justify-between">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="gap-1 border-dashed"
                >
                    <Plus className="h-4 w-4" />
                    Add item
                </Button>

                <div className="text-right">
                    <span className="mr-2 text-sm text-slate-500">Total:</span>
                    <span className="text-lg font-semibold text-slate-800">
                        ₱ {formatCurrency(total)}
                    </span>
                </div>
            </div>
        </div>
    );
}
