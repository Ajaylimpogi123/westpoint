import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Loader2, Search, SlidersHorizontal, X, TrendingUp, Package, Pill } from "lucide-react";
import ProductCard from "./ProductCard";

const MEDICINE_FORMS = [
    "Tablet",
    "Capsule",
    "Injectibles",
    "Eye drops",
    "Otic drops",
    "Film-coated tablet",
    "Syrup",
    "Drops",
    "Suppository",
    "Vial",
    "Ampule",
    "Cream",
    "Ointment",
    "Gel",
    "Sachet",
    "Powder",
    "Effervescent tablet",
    "Patch",
    "Medical Supply",
];

export default function ProductCatalog({
    products,
    searchInput,
    onSearchInputChange,
    filters,
    onFilterChange,
    onSearch,
    searchDisabled,
    loading,
    hasSearched,
    pagination,
    onPageChange,
    onAddToCart,
    cartItems,
}) {
    const [showFilters, setShowFilters] = useState(false);

    const activeFilterCount = [
        filters.form !== "",
        filters.bestSeller,
        !filters.inStock,
        filters.genericOnly,
    ].filter(Boolean).length;

    const clearFilters = () => {
        onFilterChange("form", "");
        onFilterChange("bestSeller", false);
        onFilterChange("inStock", true);
        onFilterChange("genericOnly", false);
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            onSearch();
        }
    };

    const emptyMessage =
        hasSearched && searchInput.trim()
            ? "No products match your search."
            : "No products in stock for your branch.";

    return (
        <div className="flex h-full min-w-0 flex-col space-y-4">
            {/* Search bar + filter toggle */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchInput}
                        onChange={(event) =>
                            onSearchInputChange(event.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        placeholder="Search medicines by name or brand..."
                        className="pl-9"
                    />
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFilters((prev) => !prev)}
                    className="shrink-0 gap-1.5"
                    aria-pressed={showFilters}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <Badge
                            variant="secondary"
                            className="ml-0.5 h-5 min-w-5 rounded-full px-1 text-xs"
                        >
                            {activeFilterCount}
                        </Badge>
                    )}
                </Button>

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

            {/* Filter panel */}
            {showFilters && (
                <Card className="border-dashed">
                    <CardContent className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-medium text-foreground">
                                Filters
                            </p>
                            {activeFilterCount > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                    Clear all
                                </Button>
                            )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto]">
                            {/* Form dropdown */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                    Form
                                </Label>
                                <Select
                                    value={filters.form || "__all__"}
                                    onValueChange={(value) =>
                                        onFilterChange(
                                            "form",
                                            value === "__all__" ? "" : value,
                                        )
                                    }
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="All forms" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">
                                            All forms
                                        </SelectItem>
                                        {MEDICINE_FORMS.map((form) => (
                                            <SelectItem key={form} value={form}>
                                                {form}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Fast toggles */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                    Quick filters
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    <Toggle
                                        variant="outline"
                                        size="sm"
                                        pressed={filters.bestSeller}
                                        onPressedChange={(pressed) =>
                                            onFilterChange(
                                                "bestSeller",
                                                pressed,
                                            )
                                        }
                                        className="h-9 gap-1.5 text-xs"
                                        aria-label="Best Sellers"
                                    >
                                        <TrendingUp className="h-3.5 w-3.5" />
                                        Best Sellers
                                    </Toggle>

                                    <Toggle
                                        variant="outline"
                                        size="sm"
                                        pressed={filters.inStock}
                                        onPressedChange={(pressed) =>
                                            onFilterChange("inStock", pressed)
                                        }
                                        className="h-9 gap-1.5 text-xs"
                                        aria-label="In Stock Only"
                                    >
                                        <Package className="h-3.5 w-3.5" />
                                        In Stock Only
                                    </Toggle>

                                    <Toggle
                                        variant="outline"
                                        size="sm"
                                        pressed={filters.genericOnly}
                                        onPressedChange={(pressed) =>
                                            onFilterChange(
                                                "genericOnly",
                                                pressed,
                                            )
                                        }
                                        className="h-9 gap-1.5 text-xs"
                                        aria-label="Generic Only"
                                    >
                                        <Pill className="h-3.5 w-3.5" />
                                        Generic Only
                                    </Toggle>
                                </div>
                            </div>
                        </div>

                        <p className="mt-3 text-xs text-muted-foreground">
                            Filters apply when you press{" "}
                            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                                Search
                            </kbd>{" "}
                            or hit{" "}
                            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                                Enter
                            </kbd>
                            .
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Product grid or state messages */}
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
                                cartItems={cartItems}
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
