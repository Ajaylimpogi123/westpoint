import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { isBoxUnit } from "@/lib/units";
import { AlertCircle, ShoppingBasket, Trash2 } from "lucide-react";
import { ExpiryBadge } from "./StockOutProductPanel";
import { formatExpiry, formatMoney, itemErrorFor } from "../lib/stockOutValidation";

const blockEnter = (event) => {
    // Enter in a basket cell shouldn't submit the whole form.
    if (event.key === "Enter") event.preventDefault();
};

/**
 * Basket as a table. Quantity (and pieces per box on Box lines) are edited
 * in place and re-checked against the lot on every change; the row shows
 * client or server (`items.<i>.*`) errors underneath.
 */
export default function StockOutBasketTable({
    rows,
    totals,
    errors,
    onUpdateItem,
    onNormalizeItem,
    onRemove,
    disabled = false,
    idPrefix = "",
}) {
    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                <ShoppingBasket className="h-6 w-6" />
                The basket is empty. Search a medicine, pick a lot, then add it.
            </div>
        );
    }

    return (
        <div className="min-w-0 rounded-md border bg-background">
            <Table className="min-w-[860px]">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Lot</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="w-28">Qty</TableHead>
                        <TableHead className="text-right">Pieces</TableHead>
                        <TableHead className="text-right">Unit price</TableHead>
                        <TableHead className="text-right">Line total</TableHead>
                        <TableHead className="w-10">
                            <span className="sr-only">Remove</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const { item, index, product, lot } = row;
                        const box = isBoxUnit(item.unit_type);
                        const rowError = itemErrorFor(errors, index);
                        const qtyError = errors[`items.${index}.quantity_deducted`];
                        const packError = errors[`items.${index}.pieces_per_box`];
                        const qtyId = `${idPrefix}item_${index}_qty`;
                        const packId = `${idPrefix}item_${index}_ppb`;

                        return [
                            <TableRow
                                key={`row-${index}`}
                                data-field={`items.${index}`}
                                className={cn(rowError && "border-b-0 bg-red-50/60 hover:bg-red-50/60 dark:bg-red-950/20")}
                            >
                                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                <TableCell className="min-w-[180px]">
                                    <div className="font-medium leading-tight">
                                        {product?.med_name ?? "Unknown medicine"}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {[product?.dose, product?.form, product?.brand_name]
                                            .filter(Boolean)
                                            .join(" · ") || "—"}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {lot?.lot_number ?? item.lot_number ?? "—"}
                                    {lot?.shelf_number && (
                                        <div className="text-xs text-muted-foreground">Shelf {lot.shelf_number}</div>
                                    )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                    <div className="flex flex-col items-start gap-1">
                                        {formatExpiry(lot?.expiry)}
                                        <ExpiryBadge {...row.expiry} />
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {box ? (
                                        <div className="space-y-1">
                                            <div>Box</div>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    id={packId}
                                                    data-field={`items.${index}.pieces_per_box`}
                                                    type="number"
                                                    inputMode="numeric"
                                                    min="1"
                                                    step="1"
                                                    value={item.pieces_per_box ?? ""}
                                                    onChange={(event) =>
                                                        onUpdateItem(index, "pieces_per_box", event.target.value)
                                                    }
                                                    onBlur={() => onNormalizeItem(index, "pieces_per_box")}
                                                    onKeyDown={blockEnter}
                                                    disabled={disabled}
                                                    aria-label={`Line ${index + 1} pieces per box`}
                                                    aria-invalid={Boolean(packError) || undefined}
                                                    className={cn(
                                                        "h-8 w-16 px-2 text-center",
                                                        packError && "border-red-500 focus-visible:ring-red-500",
                                                    )}
                                                />
                                                <span className="text-xs text-muted-foreground">pcs/box</span>
                                            </div>
                                        </div>
                                    ) : (
                                        "Piece"
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Input
                                        id={qtyId}
                                        data-field={`items.${index}.quantity_deducted`}
                                        type="number"
                                        inputMode="numeric"
                                        min="1"
                                        step="1"
                                        max={row.max ?? undefined}
                                        value={item.quantity_deducted}
                                        onChange={(event) =>
                                            onUpdateItem(index, "quantity_deducted", event.target.value)
                                        }
                                        onBlur={() => onNormalizeItem(index, "quantity_deducted")}
                                        onKeyDown={blockEnter}
                                        disabled={disabled}
                                        aria-label={`Line ${index + 1} quantity`}
                                        aria-invalid={Boolean(qtyError) || undefined}
                                        className={cn(
                                            "h-8 w-20 px-2 text-center",
                                            qtyError && "border-red-500 focus-visible:ring-red-500",
                                        )}
                                    />
                                    {row.max !== null && (
                                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                                            max {row.max.toLocaleString()}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {row.pieces.toLocaleString()}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right tabular-nums">
                                    {formatMoney(row.unitPrice)}
                                    <div className="text-[11px] text-muted-foreground">
                                        {box ? "wholesale/box" : "retail/pc"}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                                    {formatMoney(row.lineTotal)}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onRemove(index)}
                                        disabled={disabled}
                                        aria-label={`Remove line ${index + 1}`}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>,
                            rowError && (
                                <TableRow
                                    key={`err-${index}`}
                                    className="bg-red-50/60 hover:bg-red-50/60 dark:bg-red-950/20"
                                >
                                    <TableCell />
                                    <TableCell colSpan={9} className="pt-0">
                                        <p role="alert" className="flex items-start gap-1.5 text-sm text-red-600">
                                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                            {rowError}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ),
                        ];
                    })}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={6} className="text-sm">
                            {totals.lines} {totals.lines === 1 ? "line" : "lines"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                            {totals.pieces.toLocaleString()} pcs
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">Total</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-base font-semibold tabular-nums">
                            {formatMoney(totals.amount)}
                        </TableCell>
                        <TableCell />
                    </TableRow>
                </TableFooter>
            </Table>
            {totals.missingPrices && (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Some lines have no price yet (medicine list still loading or no price set); they are left out of the total.
                </p>
            )}
        </div>
    );
}
