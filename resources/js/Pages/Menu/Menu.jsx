import { useState, useEffect } from "react";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Head } from "@inertiajs/react";
import { ShoppingCart } from "lucide-react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import CategoryItems from "./Partials/CategoryItems";
import CartSummary from "./Partials/CartSummary";

export default function Menu({
    cartOpen,
    setCartOpen,
    setCartItemsCount,
    products,
    categories,
    cartItems,
    tables,
    table_id,
    cartItemsCount,
    filters
}) {

 
    const [cartProducts, setCartProducts] = useState([]);

    // Initialize cart with server data when component mounts
    useEffect(() => {
        if (cartItems) {
            // Check if cartItems is an array
            if (Array.isArray(cartItems)) {
                setCartProducts(cartItems);
                if (setCartItemsCount) {
                    // Calculate total items if cartItems is an array
                    const totalItems = cartItems.reduce((sum, item) => sum + (item.ct_qty), 0);
                    setCartItemsCount(totalItems);
                }
            } 
            // Check if cartItems has an items property (your original structure)
            else if (cartItems.items && Array.isArray(cartItems.items)) {
                setCartProducts(cartItems.items);
                if (setCartItemsCount) {
                    setCartItemsCount(cartItems.total_items || cartItems.items.length);
                }
            }
        }
    }, [cartItems, setCartItemsCount]);

    // Format table number properly
    const tableNumber = tables && tables.t_number ? `T${tables.t_number}` : "T4";

    // Debug: Log what's being passed to CartSummary
    // console.log("cartProducts being passed to CartSummary:", cartProducts);

    return (
        <AuthenticatedLayout>
            <Head title="Menu" />



{/* 2. Your content needs "relative" and a higher Z-index to sit on top */}
        <div className="relative z-10 py-8">
      
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Left Column - Menu */}
                        <div className="lg:col-span-2 space-y-6">
                            <CategoryItems
                                categories={categories}
                                products={products}
                                tables={tables}
                                tableId={table_id}
                                cartItems={cartProducts}
                                filters={filters}
                            />
                        </div>

                        {/* Right Column - Order Summary (Desktop only) */}
                        <div className="hidden lg:block space-y-6">
                            <CartSummary
                                products={cartProducts}  // Pass cart items
                                tableNumber={tableNumber}
                                table_id={table_id}
                                cartItemsCount={cartItemsCount}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}