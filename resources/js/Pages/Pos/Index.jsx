import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductCatalog from "./Partials/ProductCatalog";
import CartPanel from "./Partials/CartPanel";
import { usePosCart } from "./Hooks/usePosCart";
import { usePosAlerts } from "./Hooks/usePosAlerts";

export default function Index({ products, filters, branchId }) {
    const [search, setSearch] = useState(filters?.search ?? "");
    const {
        cartItems,
        discount,
        setDiscount,
        grossTotal,
        netTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateUnitType,
        clearCart,
    } = usePosCart();

    usePosAlerts();

    const isFirstSearch = useRef(true);

    useEffect(() => {
        if (isFirstSearch.current) {
            isFirstSearch.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(
                route("pos.search"),
                { search: search || undefined },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                },
            );
        }, 300);

        return () => clearTimeout(timeout);
    }, [search]);

    const handleAddToCart = useCallback(
        (product, unitType) => {
            addToCart(product, unitType);
        },
        [addToCart],
    );

    return (
        <AuthenticatedLayout>
            <Head title="Point of Sale" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Point of Sale
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Branch-scoped medicine sales with retail and wholesale
                            pricing. Stock is deducted using FEFO batch logic.
                        </p>
                        {!branchId && (
                            <p className="mt-2 text-sm text-red-300">
                                No branch is assigned to your session. Contact an
                                administrator.
                            </p>
                        )}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]">
                        <ProductCatalog
                            products={products}
                            search={search}
                            onSearchChange={setSearch}
                            onAddToCart={handleAddToCart}
                        />

                        <CartPanel
                            cartItems={cartItems}
                            discount={discount}
                            setDiscount={setDiscount}
                            grossTotal={grossTotal}
                            netTotal={netTotal}
                            onRemove={removeFromCart}
                            onUpdateQuantity={updateQuantity}
                            onUpdateUnitType={updateUnitType}
                            onCheckoutSuccess={clearCart}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
