import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useCallback } from "react";
import ProductCatalog from "./Partials/ProductCatalog";
import CartPanel from "./Partials/CartPanel";
import { usePosCart } from "./Hooks/usePosCart";
import { usePosProducts } from "./Hooks/usePosProducts";
import { usePosAlerts } from "./Hooks/usePosAlerts";

export default function Index({ branchId, activeCart }) {
    const {
        searchInput,
        setSearchInput,
        filters,
        updateFilter,
        products,
        pagination,
        loading,
        hasSearched,
        searchDisabled,
        executeSearch,
        goToPage,
    } = usePosProducts();
    const {
        cartId,
        cartItems,
        discount,
        setDiscount,
        grossTotal,
        netTotal,
        syncing,
        addToCart,
        removeFromCart,
        updateQuantity,
        setQuantity,
        updateUnitType,
        clearCart,
    } = usePosCart(activeCart, branchId);

    usePosAlerts();

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
                            searchInput={searchInput}
                            onSearchInputChange={setSearchInput}
                            filters={filters}
                            onFilterChange={updateFilter}
                            onSearch={executeSearch}
                            searchDisabled={searchDisabled}
                            loading={loading}
                            hasSearched={hasSearched}
                            pagination={pagination}
                            onPageChange={goToPage}
                            onAddToCart={handleAddToCart}
                            cartItems={cartItems}
                        />

                        <CartPanel
                            cartId={cartId}
                            cartItems={cartItems}
                            discount={discount}
                            setDiscount={setDiscount}
                            grossTotal={grossTotal}
                            netTotal={netTotal}
                            syncing={syncing}
                            onRemove={removeFromCart}
                            onUpdateQuantity={updateQuantity}
                            onSetQuantity={setQuantity}
                            onUpdateUnitType={updateUnitType}
                            onCheckoutSuccess={clearCart}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
