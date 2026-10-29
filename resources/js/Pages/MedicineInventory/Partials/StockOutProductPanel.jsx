import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getPackSize } from "@/lib/units";
import { AlertTriangle, CalendarClock, Package } from "lucide-react";
import { formatExpiry, formatMoney } from "../lib/stockOutValidation";

function Detail({ label, children }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate font-medium">{children || "—"}</dd>
        </div>
    );
}

export function ExpiryBadge({ expired, expiringSoon, daysLeft }) {
    if (expired) {
        return (
            <Badge variant="destructive" className="whitespace-nowrap">
                Expired
            </Badge>
        );
    }

    if (expiringSoon) {
        return (
            <Badge className="whitespace-nowrap border-transparent bg-orange-100 text-orange-800 shadow-none hover:bg-orange-100">
                <CalendarClock className="mr-1 h-3 w-3" />
                {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
            </Badge>
        );
    }

    return null;
}

function LotStatus({ row }) {
    const status = row.lot.status ?? "Active";

    if (status !== "Active") {
        return <Badge variant="secondary">{status}</Badge>;
    }

    if (row.expired) {
        return <Badge variant="destructive">Expired</Badge>;
    }

    if (row.remaining <= 0) {
        return <Badge variant="outline">All in basket</Badge>;
    }

    return (
        <Badge className="border-transparent bg-green-100 text-green-800 shadow-none hover:bg-green-100">
            Available
        </Badge>
    );
}

/**
 * Selected medicine's details plus its lots. Lots come oldest-expiry first
 * (FEFO); "Available" is the lot's pieces minus what the basket already
 * takes from it. Expired, inactive and fully-used lots can't be picked.
 */
export default function StockOutProductPanel({
    product,
    lotRows,
    selectedLotId,
    onSelectLot,
    idPrefix = "",
    disabled = false,
}) {
    if (!product) {
        return null;
    }

    const packSize = getPackSize(product);
    const fefoId = lotRows.find((row) => row.selectable)?.lot.id;
    const vatNote =
        product.vat_status === "VAT" ? " (VAT-exclusive)" : "";

    return (
        <div className="space-y-3 rounded-md border bg-background p-3">
            <div className="flex items-start gap-2">
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <p className="font-semibold leading-tight">{product.med_name}</p>
                    <p className="text-xs text-muted-foreground">
                        {[product.brand_name, product.dose, product.form]
                            .filter(Boolean)
                            .join(" · ") || "No brand / dose / form"}
                    </p>
                </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Detail label="Brand">{product.brand_name}</Detail>
                <Detail label="Dose / Form">
                    {[product.dose, product.form].filter(Boolean).join(" · ")}
                </Detail>
                <Detail label="Pack size">
                    {packSize >= 1 ? `${packSize} pcs/box` : "Not set"}
                </Detail>
                <Detail label={`Retail / Wholesale${vatNote}`}>
                    {formatMoney(product.retail_price)}/pc ·{" "}
                    {formatMoney(product.wholesale_price)}/box
                </Detail>
            </dl>

            <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                    Lots — earliest expiry first. Pick the lot to take stock from.
                </p>
                {lotRows.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                        No stock of this medicine in the selected branch.
                    </p>
                ) : (
                    <div className="max-h-56 overflow-auto rounded-md border">
                        <Table role="radiogroup" aria-label="Lots">
                            <TableHeader className="sticky top-0 bg-muted">
                                <TableRow>
                                    <TableHead className="w-8" />
                                    <TableHead>Lot #</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead>Shelf</TableHead>
                                    <TableHead className="text-right">Available</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lotRows.map((row) => {
                                    const id = String(row.lot.id);
                                    const checked = String(selectedLotId) === id;
                                    const inputId = `${idPrefix}lot_${id}`;
                                    const canPick = row.selectable && !disabled;

                                    return (
                                        <TableRow
                                            key={id}
                                            data-state={checked ? "selected" : undefined}
                                            onClick={() => canPick && onSelectLot(id)}
                                            className={cn(
                                                canPick ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                                                checked && "bg-primary/10 hover:bg-primary/10",
                                            )}
                                        >
                                            <TableCell>
                                                <input
                                                    id={inputId}
                                                    type="radio"
                                                    name={`${idPrefix}lot`}
                                                    value={id}
                                                    checked={checked}
                                                    disabled={!canPick}
                                                    onChange={() => onSelectLot(id)}
                                                    className="h-4 w-4 accent-primary"
                                                />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap font-medium">
                                                <label htmlFor={inputId} className={canPick ? "cursor-pointer" : undefined}>
                                                    {row.lot.lot_number}
                                                </label>
                                                {String(fefoId) === id && (
                                                    <span className="ml-1.5 text-[10px] font-semibold uppercase text-primary">
                                                        FEFO
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    {formatExpiry(row.lot.expiry)}
                                                    <ExpiryBadge {...row} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {row.lot.shelf_number || "—"}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                <span className="font-medium">
                                                    {row.remaining.toLocaleString()}
                                                </span>{" "}
                                                pcs
                                                {row.inBasket > 0 && (
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {row.inBasket.toLocaleString()} in basket
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <LotStatus row={row} />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {lotRows.length > 0 && !fefoId && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        No lot can be issued: each is expired, inactive or already fully in the basket.
                    </p>
                )}
            </div>
        </div>
    );
}
