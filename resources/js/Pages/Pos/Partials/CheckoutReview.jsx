import GenericBadge from "./GenericBadge";
import { formatCurrency } from "../lib/pricing";
import { formatDate } from "@/lib/dates";

function formatDetailLine(product) {
    return [product.dose, product.form].filter(Boolean).join(" · ") || "—";
}

export default function CheckoutReview({ items, loading, error }) {
    if (loading) {
        return (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Loading medicine review...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                No medicines in cart.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Medicine Review</h3>
                <span className="text-xs text-muted-foreground">
                    Batches allocated by earliest expiry (FEFO)
                </span>
            </div>

            <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3">
                {items.map((item) => (
                    <div
                        key={item.cart_item_id}
                        className="rounded-md border bg-background p-3 text-sm"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold">
                                        {item.product.med_name}
                                    </span>
                                    {item.product.is_generic && <GenericBadge />}
                                </div>
                                {item.product.brand_name && (
                                    <p className="text-xs text-muted-foreground">
                                        Brand: {item.product.brand_name}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {formatDetailLine(item.product)}
                                </p>
                            </div>
                            <div className="shrink-0 text-right text-xs">
                                <p className="font-medium">
                                    {formatCurrency(item.totalPrice)}
                                </p>
                                <p className="text-muted-foreground">
                                    {item.quantity} {item.unitType}
                                    {item.unitType === "Box"
                                        ? ` (${item.pieces} pcs)`
                                        : ""}
                                </p>
                            </div>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                    Unit Price
                                </span>
                                <span>{formatCurrency(item.priceUsed)}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                    Pack Size
                                </span>
                                <span>{item.product.pack_size} pcs/box</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">
                                    Pieces to Deduct
                                </span>
                                <span className="font-medium">{item.pieces}</span>
                            </div>
                        </div>

                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[28rem] text-left text-xs">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="pb-1 pr-2 font-medium">
                                            Lot Number
                                        </th>
                                        <th className="pb-1 pr-2 font-medium">
                                            Expiry
                                        </th>
                                        <th className="pb-1 pr-2 font-medium">
                                            Shelf
                                        </th>
                                        <th className="pb-1 text-right font-medium">
                                            Pieces
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {item.batches.length > 0 ? (
                                        item.batches.map((batch) => (
                                            <tr
                                                key={batch.batch_id}
                                                className="border-b border-dashed last:border-b-0"
                                            >
                                                <td className="py-1.5 pr-2">
                                                    {batch.lot_number || "—"}
                                                </td>
                                                <td className="py-1.5 pr-2">
                                                    {formatDate(batch.expiry)}
                                                </td>
                                                <td className="py-1.5 pr-2">
                                                    {batch.shelf_number || "—"}
                                                </td>
                                                <td className="py-1.5 text-right font-medium">
                                                    {batch.pieces}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="py-2 text-muted-foreground"
                                            >
                                                No batch allocation available.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
