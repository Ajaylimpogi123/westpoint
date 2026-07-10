import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    addCartItem,
    removeCartItem,
    updateCartCustomer,
    updateCartItem,
} from "../lib/posCartApi";
import {
    isDiscountEligible,
    percentDiscountAmount,
} from "../lib/customerDiscount";
import { canAddToCart, getMaxQuantity, normalizeCartQuantityInput } from "../lib/pricing";

function resolveCartError(error) {
    return (
        error?.response?.data?.message ||
        "Failed to sync cart. Please try again."
    );
}

function initialGrossTotal(items) {
    return (items ?? []).reduce(
        (sum, item) => sum + Number(item.totalPrice || 0),
        0,
    );
}

export function usePosCart(initialActiveCart, branchId) {
    const initialCustomer = initialActiveCart?.customer ?? null;
    const initialItems = initialActiveCart?.items ?? [];
    const initialGross = initialGrossTotal(initialItems);
    const initialPreset =
        initialCustomer && isDiscountEligible(initialCustomer) ? 20 : null;

    const [cartId, setCartId] = useState(initialActiveCart?.id ?? null);
    const [cartItems, setCartItems] = useState(initialItems);
    const [discount, setDiscount] = useState(() => {
        if (initialPreset === 20) {
            return percentDiscountAmount(initialGross, 20);
        }

        return 0;
    });
    const [discountPreset, setDiscountPreset] = useState(initialPreset);
    const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer);
    const [syncing, setSyncing] = useState(false);

    const grossTotal = useMemo(
        () =>
            cartItems.reduce(
                (sum, item) => sum + Number(item.totalPrice || 0),
                0,
            ),
        [cartItems],
    );

    const applyCartResponse = useCallback((data) => {
        setCartId(data.id);
        setCartItems(data.items ?? []);
        setSelectedCustomer(data.customer ?? null);
    }, []);

    useEffect(() => {
        if (!selectedCustomer || !isDiscountEligible(selectedCustomer)) {
            return;
        }

        if (discountPreset === 20) {
            setDiscount(percentDiscountAmount(grossTotal, 20));
        }
    }, [grossTotal, selectedCustomer, discountPreset]);

    useEffect(() => {
        if (discountPreset === 10) {
            setDiscount(percentDiscountAmount(grossTotal, 10));
        }
    }, [grossTotal, discountPreset]);

    const persistCartCustomer = useCallback(
        async (customer) => {
            if (!branchId) {
                toast.error("No branch assigned to your session.");
                return false;
            }

            setSyncing(true);

            try {
                const data = await updateCartCustomer(
                    customer?.customer_id ?? null,
                );
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

    const selectCustomer = useCallback(
        async (customer) => {
            const saved = await persistCartCustomer(customer);

            if (!saved) {
                return;
            }

            if (isDiscountEligible(customer)) {
                setDiscount(percentDiscountAmount(grossTotal, 20));
                setDiscountPreset(20);
                return;
            }

            setDiscount(0);
            setDiscountPreset(null);
        },
        [grossTotal, persistCartCustomer],
    );

    const clearSelectedCustomer = useCallback(async () => {
        const saved = await persistCartCustomer(null);

        if (!saved) {
            return;
        }

        setDiscount(0);
        setDiscountPreset(null);
    }, [persistCartCustomer]);

    const togglePercentDiscount = useCallback(
        (percent) => {
            if (discountPreset === percent) {
                setDiscount(0);
                setDiscountPreset(null);
                return;
            }

            setDiscount(percentDiscountAmount(grossTotal, percent));
            setDiscountPreset(percent);
        },
        [discountPreset, grossTotal],
    );

    const setDiscountManual = useCallback((value) => {
        setDiscount(value);
        setDiscountPreset(null);
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
            if (!canAddToCart(product, unitType, cartItems)) {
                toast.error(`Insufficient stock for ${product.med_name}.`);

                return;
            }

            await syncCart(() => addCartItem(product.id, unitType));
        },
        [cartItems, syncCart],
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

            const maxQty = getMaxQuantity(
                item.product,
                item.unitType,
                cartItems,
                key,
            );
            const quantity = Math.max(1, Math.min(item.quantity + change, maxQty));

            if (quantity <= 0) {
                await syncCart(() => removeCartItem(item.id));

                return;
            }

            if (quantity === item.quantity) {
                if (change > 0) {
                    toast.error(
                        `Insufficient stock for ${item.product.med_name}.`,
                    );
                }

                return;
            }

            await syncCart(() =>
                updateCartItem(item.id, { quantity_sold: quantity }),
            );
        },
        [cartItems, syncCart],
    );

    const setQuantity = useCallback(
        async (key, rawQuantity) => {
            const item = cartItems.find((entry) => entry.key === key);

            if (!item?.id) {
                return;
            }

            const maxQty = getMaxQuantity(
                item.product,
                item.unitType,
                cartItems,
                key,
            );
            const trimmed = String(rawQuantity ?? "").trim();
            const parsed = Math.floor(Number(trimmed));
            const quantity = normalizeCartQuantityInput(rawQuantity, maxQty);

            if (Number.isFinite(parsed) && parsed > maxQty) {
                toast.error(
                    `Insufficient stock for ${item.product.med_name}.`,
                );
            }

            if (quantity === item.quantity) {
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
        setDiscountPreset(null);
        setSelectedCustomer(null);
    }, []);

    const netTotal = useMemo(
        () => Math.max(grossTotal - (Number(discount) || 0), 0),
        [grossTotal, discount],
    );

    return {
        cartId,
        cartItems,
        discount,
        setDiscount: setDiscountManual,
        discountPreset,
        togglePercentDiscount,
        selectedCustomer,
        selectCustomer,
        clearSelectedCustomer,
        grossTotal,
        netTotal,
        syncing,
        addToCart,
        removeFromCart,
        updateQuantity,
        setQuantity,
        updateUnitType,
        clearCart,
    };
}
