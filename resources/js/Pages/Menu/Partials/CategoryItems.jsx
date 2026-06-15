import { useState } from "react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { router, useForm } from "@inertiajs/react";
import { Card, CardContent } from "@/Components/ui/card";
import { toast } from "sonner";
import { CircleCheck, Utensils, Minus, Plus } from "lucide-react";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function CategoryItems({
    children,
    categories = [],
    products = [],
    tables,
    cartItems = [],
    filters
}) {
    const [activeCategory, setActiveCategory] = useState("all");
    const [loadingItem, setLoadingItem] = useState(null);
    // Store quantities for each product
    const [quantities, setQuantities] = useState({});

    // Get the current table
    const currentTable = tables;

    const foodItems = products.map((product) => ({
        cat_id: product.cat_id,
        pd_id: product.pd_id,
        pd_name: product.pd_name,
        pd_description: product.pd_description,
        pd_price: product.pd_price,
        pd_image: product.pd_image,
        pd_status: product.pd_status,
        pd_qty: product.pd_qty,
    }));

    const filteredItems = activeCategory === "all" 
        ? foodItems 
        : foodItems.filter((item) => Number(item.cat_id) === Number(activeCategory));

    const totalItems = categories.reduce(
        (total, category) => total + (category.products?.length || 0),
        0,
    );

    // Initialize quantity for a product
    const getQuantity = (productId) => {
        return quantities[productId] || 1;
    };

    // Update quantity for a product
    const updateQuantity = (productId, change) => {
        setQuantities(prev => {
            const currentQty = prev[productId] || 1;
            const newQty = Math.max(1, currentQty + change);
            return { ...prev, [productId]: newQty };
        });
    };

    const addToCart = (product) => {
        if (!currentTable) {
            toast.error("No table selected", {
                position: "top-center",
                duration: 3000,
            });
            return;
        }

        const quantity = getQuantity(product.pd_id);

        setLoadingItem(product.pd_id);

        router.post(
            route("cart.store", currentTable.table_id),
            {
                pd_id: product.pd_id,
                table_id: currentTable.table_id,
                table_number: currentTable.t_number,
                ct_qty: quantity,
                ct_price: product.pd_price,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    toast.success(`${quantity} x ${product.pd_name} added to cart!`, {
                        duration: 3000,
                        position: "top-center",
                        icon: <CircleCheck className="w-5 h-5 text-green-600" />,
                    });
                    // Reset quantity to 1 after adding
                    setQuantities(prev => ({ ...prev, [product.pd_id]: 1 }));
                    setLoadingItem(null);
                },
                onError: (errors) => {
                    const errorMessage = Object.values(errors)[0] || "Failed to add item";
                    toast.error(errorMessage, {
                        duration: 4000,
                        position: "top-center",
                    });
                    setLoadingItem(null);
                },
            },
        );
    };

    const { data, setData } = useForm({
        search: filters?.search || "",
    });

    const handleSearch = (e) => {
        const value = e.target.value;
        setData("search", value);

        router.get(
            route("menu.menu", currentTable?.table_id),
            { search: value },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
                only: ["products", "filters"],
            },
        );
    };

    return (
        <>
            <Field>
                <FieldLabel htmlFor="input-button-group" className="text-white">Search</FieldLabel>
                <ButtonGroup className="w-full">
                    <Input
                        value={data.search}
                        onChange={handleSearch}
                        id="input-button-group"
                        placeholder="Type to search..."
                        className="w-full bg-white"
                    />
                    <Button variant="outline" className="hover:bg-green-500">
                        Search
                    </Button>
                </ButtonGroup>
            </Field>

            <Card>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:pb-3 overflow-x-auto pb-4">
                        <div className="flex">
                            {/* All Categories Button */}
                            <button
                                onClick={() => setActiveCategory("all")}
                                className={`flex-shrink-0 flex flex-col items-center rounded-lg transition-all duration-300
                                    w-28 sm:w-28 sm:p-2 md:w-36 md:p-2 mt-4 mr-1
                                    ${
                                        activeCategory === "all"
                                            ? "bg-gradient-to-b from-white to-green-50 border-b-4 border-green-500 shadow-sm sm:shadow-md"
                                            : "bg-gradient-to-b from-gray-100 to-gray-50 hover:from-gray-50 hover:to-green-100 border-t-4 border-gray-300 hover:border-green-500"
                                    }`}
                            >
                                <div
                                    className={`rounded-full mb-1 sm:mb-2 p-1.5 sm:p-2 ${
                                        activeCategory === "all"
                                            ? "bg-green-200"
                                            : "bg-gray-100"
                                    }`}
                                >
                                    <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <span
                                    className={`font-medium text-center line-clamp-1 text-xs sm:text-sm md:text-base ${
                                        activeCategory === "all"
                                            ? "text-gray-900"
                                            : "text-gray-800"
                                    }`}
                                >
                                    All
                                </span>
                                <span
                                    className={`mt-0.5 sm:mt-1 text-xs ${
                                        activeCategory === "all" ? "text-gray-700" : "text-gray-600"
                                    }`}
                                >
                                    {totalItems}
                                </span>
                            </button>

                            {categories.map((category) => (
                                <button
                                    key={category.cat_id}
                                    onClick={() => setActiveCategory(category.cat_id)}
                                    className={`flex-shrink-0 flex flex-col items-center rounded-lg transition-all duration-300
                                        w-28 sm:w-28 sm:p-2 md:w-36 md:p-2 mt-4 mr-1
                                        ${
                                            activeCategory === category.cat_id
                                                ? "bg-gradient-to-b from-white to-green-50 border-b-4 border-green-500 shadow-sm sm:shadow-md"
                                                : "bg-gradient-to-b from-gray-100 to-gray-50 hover:from-gray-50 hover:to-green-100 border-t-4 border-gray-300 hover:border-green-500"
                                        }`}
                                >
                                    <div
                                        className={`rounded-full mb-1 sm:mb-2 p-1.5 sm:p-2 ${
                                            activeCategory === category.cat_id
                                                ? "bg-green-200"
                                                : "bg-gray-100"
                                        }`}
                                    >
                                        <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </div>
                                    <span
                                        className={`font-medium text-center line-clamp-1 text-md md:text-md md:text-base ${
                                            activeCategory === category.cat_id
                                                ? "text-gray-900"
                                                : "text-gray-800"
                                        }`}
                                    >
                                        {category.cat_name}
                                    </span>
                                    <span
                                        className={`mt-0.5 sm:mt-1 text-xs ${
                                            activeCategory === category.cat_id ? "text-gray-700" : "text-gray-600"
                                        }`}
                                    >
                                        {category.products?.length || 0}{" "}
                                        {category.products?.length === 1 ? "item" : "items"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Food Items Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item) => {
                    const isInvalidItem = !item.pd_id || item.pd_id === 0;
                    const displayStatus = isInvalidItem
                        ? "Not Available"
                        : item.pd_status || "Out of Stock";
                    const isAvailable = !isInvalidItem && item.pd_status === "Available";
                    const isLoading = loadingItem === item.pd_id;
                    const quantity = getQuantity(item.pd_id);

                    return (
                        <Card
                            key={item.pd_id || Math.random()}
                            className="overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <CardContent className="p-4">
                                {/* Item Header */}
                                <div className="flex justify-center items-center mb-3">
                                    {item.pd_image && !isInvalidItem ? (
                                        <div className="w-full max-w-[200px]">
                                            <div className="relative aspect-square w-full">
                                                <img
                                                    src={`/storage/${item.pd_image}`}
                                                    alt={item.pd_name}
                                                    className="rounded-lg object-cover w-full h-full"
                                                />
                                                <div className="absolute top-1 right-1 px-1.5 py-1 rounded text-xs font-semibold">
                                                    <Badge
                                                        variant="outline"
                                                        className={`${
                                                            isAvailable
                                                                ? "bg-green-50 text-green-700 border-green-200"
                                                                : "bg-red-50 text-red-700 border-red-200"
                                                        }`}
                                                    >
                                                        {displayStatus}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-[200px]">
                                            <div className="relative aspect-square w-full bg-gray-100 rounded-lg flex items-center justify-center">
                                                <span className="text-gray-400 text-sm">
                                                    No Image
                                                </span>
                                                <div className="absolute top-1 right-1 px-1.5 py-1 rounded text-xs font-semibold">
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-red-50 text-red-700 border-red-200"
                                                    >
                                                        {displayStatus}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Item Details */}
                                <div>
                                    <h3 className="font-bold text-gray-700 text-base sm:text-md mb-2">
                                        {item.pd_name || "Unnamed Item"}
                                    </h3>
                                </div>

                                {/* Price */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-md sm:text-md font-bold text-green-600">
                                        ₱{item.pd_price || "0.00"}
                                    </span>
                                </div>

                            {/* Quantity Selector */}
{isAvailable && !isInvalidItem && item.pd_qty > 0 && (
    <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <span>Quantity</span>
                <span className="text-xs text-gray-400">(Max: {item.pd_qty})</span>
            </label>
            {/* <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                In Stock
            </span> */}
        </div>
        
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-2  hover:border-green-500 hover:bg-green-100 transition-all duration-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-gray-200"
                onClick={() => updateQuantity(item.pd_id, -1)}
                disabled={quantity <= 1 || isLoading}
            >
                <Minus className={`h-4 w-4 ${quantity <= 1 ? 'text-gray-300' : 'text-gray-600'}`} />
            </Button>

            <div className="relative flex-1">
                <input
                    type="number"
                    min="1"
                    max={item.pd_qty}
                    value={quantity}
                    onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        const newQty = Math.min(val, item.pd_qty);
                        setQuantities(prev => ({
                            ...prev,
                            [item.pd_id]: newQty
                        }));
                    }}
                    className="w-full h-7 text-center border-2 rounded-xl py-2 px-3 text-base font-semibold 
                             focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                             disabled:bg-gray-50 disabled:text-gray-400
                             [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    disabled={isLoading}
                />
                {quantity >= item.pd_qty && (
                    <span className="absolute -top-2 right-0 text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                        Max
                    </span>
                )}
            </div>

            <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-full border-2 hover:border-green-500 hover:bg-green-100 transition-all duration-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-gray-200"
                onClick={() => updateQuantity(item.pd_id, 1)}
                disabled={quantity >= item.pd_qty || isLoading}
            >
                <Plus className={`h-4 w-4 ${quantity >= item.pd_qty ? 'text-gray-300' : 'text-gray-600'}`} />
            </Button>
        </div>



    
    </div>
)}

                                {/* Add to Cart Button */}
                                <div className="flex items-center justify-center">
                                    <Button
                                        size="sm"
                                        className={`text-sm sm:text-base w-full rounded-full ${
                                            isInvalidItem || !isAvailable || item.pd_qty === 0
                                                ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                                                : "bg-green-600 hover:bg-green-700"
                                        }`}
                                        onClick={() => addToCart(item)}
                                        disabled={
                                            isInvalidItem ||
                                            loadingItem === item.pd_id ||
                                            item.pd_qty === 0 ||
                                            !isAvailable
                                        }
                                    >
                                        {isInvalidItem
                                            ? "Not Available"
                                            : loadingItem === item.pd_id
                                                ? "Adding..."
                                                : !isAvailable || item.pd_qty === 0
                                                    ? "Out of Stock"
                                                    : `+ Add (${quantity})`}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <div className="mt-4">{children}</div>
        </>
    );
}