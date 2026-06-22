import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductCatalog({
    products,
    search,
    onSearchChange,
    onAddToCart,
    hasProducts,
}) {
    const emptyMessage = hasProducts
        ? "No products match your search."
        : "No products in stock for your branch.";

    return (
        <div className="flex h-full flex-col space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search medicines by name, brand, dose, or form..."
                    className="pl-9"
                />
            </div>

            {products.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {emptyMessage}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid max-h-[calc(100vh-14rem)] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={onAddToCart}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
