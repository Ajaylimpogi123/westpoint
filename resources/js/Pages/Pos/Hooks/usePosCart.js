import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    addCartItem,
    removeCartItem,
    updateCartItem,
} from "../lib/posCartApi";

function resolveCartError(error) {
    return (
        error?.response?.data?.message ||
        "Failed to sync cart. Please try again."
    );
}

export function usePosCart(initialActiveCart, branchId) {
    const [cartId, setCartId] = useState(initialActiveCart?.id ?? null);
    const [cartItems, setCartItems] = useState(initialActiveCart?.items ?? []);
    const [discount, setDiscount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    const applyCartResponse = useCallback((data) => {
        setCartId(data.id);
        setCartItems(data.items ?? []);
    }, []);

    const syncCart = useCallback(
        async (operation) => {
            if (!branchId) {
                toast.error("No branch assigned to your session.");
                return false;
            }

            setSyncing(true);

            try {
                const data = await operation();
                applyCartResponse(data);

                return true;
            } catch (error) {
                toast.error(resolveCartError(error));

                return false;
            } finally {
                setSyncing(false);
            }
        },
        [applyCartResponse, branchId],
    );

    const addToCart = useCallback(
        async (product, unitType = "Piece") => {
            await syncCart(() => addCartItem(product.id, unitType));
        },
        [syncCart],
    );

    const removeFromCart = useCallback(
        async (key) => {
            const item = cartItems.find((entry) => entry.key === key);

            if (!item?.id) {
                return;
            }

            await syncCart(() => removeCartItem(item.id));
        },
        [cartItems, syncCart],
    );

    const updateQuantity = useCallback(
        async (key, change) => {
            const item = cartItems.find((entry) => entry.key === key);

            if (!item?.id) {
                return;
            }

            const quantity = Math.max(1, item.quantity + change);

            if (quantity <= 0) {
                await syncCart(() => removeCartItem(item.id));

                return;
            }

            await syncCart(() =>
                updateCartItem(item.id, { quantity_sold: quantity }),
            );
        },
        [cartItems, syncCart],
    );

    const updateUnitType = useCallback(
        async (key, unitType) => {
            const item = cartItems.find((entry) => entry.key === key);

            if (!item?.id || item.unitType === unitType) {
                return;
            }

            await syncCart(() => updateCartItem(item.id, { unit_type: unitType }));
        },
        [cartItems, syncCart],
    );

    const clearCart = useCallback(() => {
        setCartId(null);
        setCartItems([]);
        setDiscount(0);
    }, []);

    const grossTotal = useMemo(
        () =>
            cartItems.reduce(
                (sum, item) => sum + Number(item.totalPrice || 0),
                0,
            ),
        [cartItems],
    );

    const netTotal = useMemo(
        () => Math.max(grossTotal - (Number(discount) || 0), 0),
        [grossTotal, discount],
    );

    return {
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
        updateUnitType,
        clearCart,
    };
}
