import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import ProductCard from "./ProductCard";

export default function ProductCatalog({
    products,
    searchInput,
    onSearchInputChange,
    onSearch,
    searchDisabled,
    loading,
    hasSearched,
    pagination,
    onPageChange,
    onAddToCart,
}) {
    const emptyMessage =
        hasSearched && searchInput.trim()
            ? "No products match your search."
            : "No products in stock for your branch.";

    return (
        <div className="flex h-full flex-col space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchInput}
                        onChange={(event) =>
                            onSearchInputChange(event.target.value)
                        }
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                onSearch();
                            }
                        }}
                        placeholder="Search medicines by name or brand..."
                        className="pl-9"
                    />
                </div>
                <Button
                    type="button"
                    onClick={onSearch}
                    disabled={searchDisabled}
                >
                    {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Search className="mr-2 h-4 w-4" />
                    )}
                    Search
                </Button>
            </div>

            {loading ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                        Loading products...
                    </CardContent>
                </Card>
            ) : products.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {emptyMessage}
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div
                        id="pos-product-grid"
                        className="grid max-h-[calc(100vh-18rem)] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
                    >
                        {products.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={onAddToCart}
                            />
                        ))}
                    </div>

                    {pagination && pagination.lastPage > 1 && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing {pagination.from ?? 0} to{" "}
                                {pagination.to ?? 0} of {pagination.total ?? 0}{" "}
                                products
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        onPageChange(
                                            pagination.currentPage - 1,
                                        )
                                    }
                                    disabled={
                                        loading ||
                                        pagination.currentPage <= 1
                                    }
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {pagination.currentPage} of{" "}
                                    {pagination.lastPage}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        onPageChange(
                                            pagination.currentPage + 1,
                                        )
                                    }
                                    disabled={
                                        loading ||
                                        pagination.currentPage >=
                                            pagination.lastPage
                                    }
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
