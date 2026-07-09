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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency, getMaxQuantity, normalizeCartQuantityInput } from "../lib/pricing";

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
            className="h-7 w-14 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
        <div className="max-h-[360px] overflow-y-auto rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cartItems.map((item) => {
                        const maxQty = getMaxQuantity(
                            item.product,
                            item.unitType,
                            cartItems,
                            item.key,
                        );

                        return (
                        <TableRow key={item.key}>
                            <TableCell>
                                <div className="font-medium">
                                    {item.product.med_name}
                                </div>
                                {item.product.brand_name && (
                                    <div className="text-xs text-muted-foreground">
                                        {item.product.brand_name}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                <Select
                                    value={item.unitType}
                                    onValueChange={(value) =>
                                        onUpdateUnitType(item.key, value)
                                    }
                                    disabled={syncing}
                                >
                                    <SelectTrigger className="h-8 w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Piece">
                                            Piece
                                        </SelectItem>
                                        <SelectItem value="Box">Box</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
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
                                        className="h-7 w-7"
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
                            </TableCell>
                            <TableCell className="text-right">
                                {formatCurrency(item.priceUsed)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                                {formatCurrency(item.totalPrice)}
                            </TableCell>
                            <TableCell>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                    onClick={() => onRemove(item.key)}
                                    disabled={syncing}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
