import { Button } from "@/components/ui/button";
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
import { formatCurrency } from "../lib/pricing";

export default function CartTable({
    cartItems,
    onRemove,
    onUpdateQuantity,
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
                    {cartItems.map((item) => (
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
                                        disabled={item.quantity <= 1}
                                    >
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center text-sm font-medium">
                                        {item.quantity}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() =>
                                            onUpdateQuantity(item.key, 1)
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
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
