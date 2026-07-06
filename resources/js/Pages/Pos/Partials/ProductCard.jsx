import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import StockStatusBadge from "./StockStatusBadge";
import { formatCurrency } from "../lib/pricing";

export default function ProductCard({ product, onAddToCart }) {
    const totalStock = Number(product.total_stock) || 0;

    return (
        <Card className="flex flex-col transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                        {product.med_name}
                    </CardTitle>
                    <StockStatusBadge
                        totalStock={totalStock}
                        packSize={product.pack_size}
                    />
                </div>
                {product.brand_name && (
                    <p className="text-xs font-semibold text-foreground">
                        {product.brand_name}
                    </p>
                )}
            </CardHeader>

            <CardContent className="flex-1 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Dose / Form</span>
                    <span>
                        {[product.dose, product.form].filter(Boolean).join(" · ") ||
                            "—"}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Pack Size</span>
                    <span>{product.pack_size} pcs/box</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch Stock</span>
                    <span className="font-medium">{totalStock} pcs</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Retail (Piece)</span>
                    <span className="font-medium text-green-700">
                        {formatCurrency(product.retail_price)}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Wholesale (Box)</span>
                    <span className="font-medium text-blue-700">
                        {formatCurrency(product.wholesale_price)}
                    </span>
                </div>
            </CardContent>

            <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddToCart(product, "Piece")}
                >
                    <Plus className="mr-1 h-3 w-3" />
                    Piece
                </Button>
                <Button
                    size="sm"
                    onClick={() => onAddToCart(product, "Box")}
                >
                    <Plus className="mr-1 h-3 w-3" />
                    Box
                </Button>
            </CardFooter>
        </Card>
    );
}
