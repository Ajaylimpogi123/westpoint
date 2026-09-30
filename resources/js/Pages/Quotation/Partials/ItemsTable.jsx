import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import MedicineSearchSelect from "./MedicineSearchSelect";

const EMPTY_ERRORS = {};
const ITEMS_PER_PAGE = 10;
const BOX_UNITS = ["BXS", "BOX", "BX"];
const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

const isBoxUnit = (unit) =>
    BOX_UNITS.includes(
        String(unit ?? "")
            .trim()
            .toUpperCase(),
    );

const ItemRow = memo(function ItemRow({
    item,
    index,
    rowErrors,
    updateItem,
    removeItem,
    onSelectMedicine,
    onUnitChange,
    onClearMedicine,
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

    const hasLinkedProduct = Boolean(item.product_id);
    const isBox = isBoxUnit(item.qt_unit);
    const packSize = item._medicineMeta?.pack_size;

    // Pre-fill pcs-per-box from the product's pack size the first time the
    // row becomes a Box line. Runs once per switch, so clearing the field to
    // type a different number doesn't get overwritten.
    const autofilled = useRef(false);
    useEffect(() => {
        if (!isBox) {
            autofilled.current = false;
            return;
        }
        if (autofilled.current) return;
        autofilled.current = true;
        if (!item.qt_pcs_per_box && packSize) {
            updateItem(index, "qt_pcs_per_box", String(packSize));
        }
    }, [isBox, packSize]);

    const handleUnitSelect = (e) => {
        const unit = e.target.value;

        if (hasLinkedProduct) {
            // Linked rows keep using the existing handler so the unit price
            // still switches between retail and wholesale.
            onUnitChange(index, unit);
        } else {
            updateItem(index, "qt_unit", unit);
        }
    };

    return (
        <TableRow>
            <TableCell className="min-w-[260px] align-top">
                <MedicineSearchSelect
                    value={item.qt_description}
                    onSelect={(product) => onSelectMedicine(index, product)}
                    onClear={
                        hasLinkedProduct
                            ? () => onClearMedicine(index)
                            : undefined
                    }
                    error={rowErrors.qt_description}
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
                <select
                    value={isBox ? "BXS" : "PIECE"}
                    onChange={handleUnitSelect}
                    className={`${inputCls} w-28`}
                >
                    <option value="PIECE">Pcs</option>
                    <option value="BXS">Box</option>
                </select>

                {isBox && (
                    <div className="mt-2">
                        <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.qt_pcs_per_box ?? ""}
                            onChange={handleChange("qt_pcs_per_box")}
                            placeholder="Pcs / box"
                            className="w-28"
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                            pcs per box
                        </p>
                        {rowErrors.qt_pcs_per_box && (
                            <p className="mt-1 text-xs text-red-500">
                                {rowErrors.qt_pcs_per_box}
                            </p>
                        )}
                    </div>
                )}
            </TableCell>
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
    onSelectMedicine,
    onUnitChange,
    onClearMedicine,
    total,
}) {
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

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const visibleItems = items
        .slice(startIndex, startIndex + ITEMS_PER_PAGE)
        .map((item, i) => ({ item, index: startIndex + i }));

    function handleAddItem() {
        addItem();
        setPage(Math.ceil((items.length + 1) / ITEMS_PER_PAGE));
    }

    return (
        <div>
            <Card className="overflow-hidden py-0">
                <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead>Description</TableHead>
                                <TableHead className="w-36">Expiry</TableHead>
                                <TableHead className="w-32">Unit</TableHead>
                                <TableHead className="w-16">Qty</TableHead>
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
                                    key={item._clientId ?? item.id ?? index}
                                    item={item}
                                    index={index}
                                    rowErrors={
                                        errorsByIndex[index] ?? EMPTY_ERRORS
                                    }
                                    updateItem={updateItem}
                                    removeItem={removeItem}
                                    onSelectMedicine={onSelectMedicine}
                                    onUnitChange={onUnitChange}
                                    onClearMedicine={onClearMedicine}
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
