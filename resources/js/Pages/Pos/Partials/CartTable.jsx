import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Minus, Plus, Trash2 } from "lucide-react";
import GenericBadge from "./GenericBadge";
import {
    formatCurrency,
    getMaxQuantity,
    normalizeCartQuantityInput,
} from "../lib/pricing";

const CART_ROW_GRID =
    "grid grid-cols-[2fr_1.2fr_1.5fr_1fr_1fr] items-center gap-1";

function CartQuantityInput({
    itemKey,
    quantity,
    maxQty,
    syncing,
    onSetQuantity,
}) {
    const [draft, setDraft] = useState(String(quantity));

    useEffect(() => {
        setDraft(String(quantity));
    }, [quantity]);

    const applyNormalizedDraft = (rawValue) => {
        const normalized = normalizeCartQuantityInput(rawValue, maxQty);

        setDraft(String(normalized));

        return normalized;
    };

    const handleInputChange = (event) => {
        applyNormalizedDraft(event.target.value);
    };

    const commitDraft = () => {
        const normalized = applyNormalizedDraft(draft);

        onSetQuantity(itemKey, normalized);
    };

    return (
        <Input
            type="number"
            min={1}
            max={maxQty}
            value={draft}
            onChange={handleInputChange}
            onBlur={commitDraft}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    event.currentTarget.blur();
                }
            }}
            disabled={syncing}
            className="h-6 w-10 px-0.5 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
    );
}

export default function CartTable({
    cartItems,
    syncing,
    onRemove,
    onUpdateQuantity,
    onSetQuantity,
    onUpdateUnitType,
}) {
    if (cartItems.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
                Cart is empty. Add products from the catalog.
            </div>
        );
    }

    return (
        <div className="max-h-[360px] overflow-x-hidden overflow-y-auto rounded-md border">
            <div className="min-w-0">
                <div
                    className={`${CART_ROW_GRID} border-b bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground`}
                >
                    <div className="min-w-0 truncate">Product</div>
                    <div>Unit</div>
                    <div className="text-center">Qty</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Total</div>
                </div>

                {cartItems.map((item) => {
                    const maxQty = getMaxQuantity(
                        item.product,
                        item.unitType,
                        cartItems,
                        item.key,
                    );

                    return (
                        <div
                            key={item.key}
                            className={`${CART_ROW_GRID} border-b px-2 py-2 text-xs last:border-b-0`}
                        >
                            <div className="min-w-0">
                                <div className="flex items-start justify-between gap-0.5">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <div className="truncate font-medium">
                                                {item.product.med_name}
                                            </div>
                                            {item.product.is_generic && (
                                                <GenericBadge className="shrink-0 px-1.5 py-0.5 text-[10px]" />
                                            )}
                                        </div>
                                        {item.product.brand_name && (
                                            <div className="truncate text-muted-foreground">
                                                {item.product.brand_name}
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-600"
                                        onClick={() => onRemove(item.key)}
                                        disabled={syncing}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <Select
                                    value={item.unitType}
                                    onValueChange={(value) =>
                                        onUpdateUnitType(item.key, value)
                                    }
                                    disabled={syncing}
                                >
                                    <SelectTrigger className="h-7 w-full min-w-0 px-2 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Piece">
                                            Piece
                                        </SelectItem>
                                        <SelectItem value="Box">Box</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center justify-center gap-0.5">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                            onUpdateQuantity(item.key, -1)
                                        }
                                        disabled={syncing || item.quantity <= 1}
                                    >
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <CartQuantityInput
                                        itemKey={item.key}
                                        quantity={item.quantity}
                                        maxQty={maxQty}
                                        syncing={syncing}
                                        onSetQuantity={onSetQuantity}
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                            onUpdateQuantity(item.key, 1)
                                        }
                                        disabled={
                                            syncing || item.quantity >= maxQty
                                        }
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            <div className="truncate text-right tabular-nums">
                                {formatCurrency(item.priceUsed)}
                            </div>
                            <div className="truncate text-right font-medium tabular-nums">
                                {formatCurrency(item.totalPrice)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
