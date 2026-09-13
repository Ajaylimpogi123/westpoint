import { useCallback, useMemo, useState } from "react";
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
import {
    canAddToCart,
    getMaxQuantity,
    getUnitPrice,
    normalizeCartQuantityInput,
} from "../lib/pricing";

function resolveCartError(error) {
    return (
        error?.response?.data?.message ||
        "Failed to sync cart. Please try again."
    );
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function usePosCart(initialActiveCart, branchId) {
    const initialCustomer = initialActiveCart?.customer ?? null;
    const initialItems = initialActiveCart?.items ?? [];
    const initialPercent =
        initialCustomer && isDiscountEligible(initialCustomer) ? 20 : 0;

    const [cartId, setCartId] = useState(initialActiveCart?.id ?? null);
    const [cartItems, setCartItems] = useState(initialItems);
    const [discountPercent, setDiscountPercentState] = useState(initialPercent);
    const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer);
    const [syncing, setSyncing] = useState(false);
    // Keys of cart items the discount should be applied to. A Set of
    // item.key (not id) since key is stable across the cart's lifetime.
    const [discountedKeys, setDiscountedKeys] = useState(() => new Set());
    // Keys of discounted items whose VAT has additionally been removed
    // (PWD/Senior/Solo Parent purchases are VAT-exempt by law, but the
    // cashier opts in per item rather than it being automatic).
    const [vatExemptKeys, setVatExemptKeys] = useState(() => new Set());

    const applyCartResponse = useCallback((data) => {
        setCartId(data.id);
        const items = data.items ?? [];
        setCartItems(items);
        setSelectedCustomer(data.customer ?? null);
        // Drop any checked keys for items that no longer exist in the cart
        // (removed, or replaced by a merge on unit-type change), so a stale
        // key can't silently keep "counting" toward a future discount/VAT
        // exemption.
        setDiscountedKeys((current) => {
            const validKeys = new Set(items.map((item) => item.key));
            const next = new Set();
            current.forEach((key) => {
                if (validKeys.has(key)) {
                    next.add(key);
                }
            });
            return next;
        });
        setVatExemptKeys((current) => {
            const validKeys = new Set(items.map((item) => item.key));
            const next = new Set();
            current.forEach((key) => {
                if (validKeys.has(key)) {
                    next.add(key);
                }
            });
            return next;
        });
    }, []);

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

            setDiscountPercentState(isDiscountEligible(customer) ? 20 : 0);
        },
        [persistCartCustomer],
    );

    const clearSelectedCustomer = useCallback(async () => {
        const saved = await persistCartCustomer(null);

        if (!saved) {
            return;
        }

        setDiscountPercentState(0);
        setDiscountedKeys(new Set());
        setVatExemptKeys(new Set());
    }, [persistCartCustomer]);

    const togglePercentDiscount = useCallback((percent) => {
        setDiscountPercentState((current) => {
            const next = current === percent ? 0 : percent;

            // Turning the discount off entirely should clear any per-item
            // checks and VAT exemptions, so re-enabling it later starts
            // from a clean slate instead of resurrecting an old selection.
            if (next === 0) {
                setDiscountedKeys(new Set());
                setVatExemptKeys(new Set());
            }

            return next;
        });
    }, []);

    const setDiscountPercent = useCallback((value) => {
        const clamped = Math.min(Math.max(Number(value) || 0, 0), 100);
        setDiscountPercentState(clamped);
    }, []);

    const toggleItemDiscount = useCallback((key) => {
        setDiscountedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
                // VAT exemption only makes sense alongside an applied
                // discount — unchecking the discount clears it too.
                setVatExemptKeys((currentVat) => {
                    if (!currentVat.has(key)) {
                        return currentVat;
                    }
                    const nextVat = new Set(currentVat);
                    nextVat.delete(key);
                    return nextVat;
                });
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const toggleVatExempt = useCallback((key) => {
        setVatExemptKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
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
            const quantity = Math.max(
                1,
                Math.min(item.quantity + change, maxQty),
            );

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
                toast.error(`Insufficient stock for ${item.product.med_name}.`);
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

            await syncCart(() =>
                updateCartItem(item.id, { unit_type: unitType }),
            );
        },
        [cartItems, syncCart],
    );

    const clearCart = useCallback(() => {
        setCartId(null);
        setCartItems([]);
        setDiscountPercentState(0);
        setSelectedCustomer(null);
        setDiscountedKeys(new Set());
        setVatExemptKeys(new Set());
    }, []);

    // Cart items annotated with discount + VAT-exemption state. VAT
    // exemption is only ever honored when the item's discount is also
    // checked and the product is actually a VAT item — otherwise the
    // toggle wouldn't be shown in the UI in the first place, but this
    // guards the math even if state somehow got out of sync.
    const cartItemsWithDiscount = useMemo(
        () =>
            cartItems.map((item) => {
                const applyDiscount = discountedKeys.has(item.key);
                const isVatProduct = item.product?.vat_status === "VAT";
                const vatEligibleForExemption = isVatProduct && applyDiscount;
                const vatExempt =
                    vatEligibleForExemption && vatExemptKeys.has(item.key);

                const priceUsed = vatExempt
                    ? getUnitPrice(item.product, item.unitType, {
                          vatExempt: true,
                      })
                    : item.priceUsed;
                const totalPrice = vatExempt
                    ? round2(priceUsed * item.quantity)
                    : item.totalPrice;

                return {
                    ...item,
                    applyDiscount,
                    vatEligibleForExemption,
                    vatExempt,
                    priceUsed,
                    totalPrice,
                };
            }),
        [cartItems, discountedKeys, vatExemptKeys],
    );

    const grossTotal = useMemo(
        () =>
            cartItemsWithDiscount.reduce(
                (sum, item) => sum + Number(item.totalPrice || 0),
                0,
            ),
        [cartItemsWithDiscount],
    );

    const discountAmount = useMemo(
        () =>
            discountPercent > 0
                ? cartItemsWithDiscount.reduce(
                      (sum, item) =>
                          item.applyDiscount
                              ? sum +
                                percentDiscountAmount(
                                    item.totalPrice,
                                    discountPercent,
                                )
                              : sum,
                      0,
                  )
                : 0,
        [cartItemsWithDiscount, discountPercent],
    );

    const netTotal = useMemo(
        () => Math.max(grossTotal - discountAmount, 0),
        [grossTotal, discountAmount],
    );

    return {
        cartId,
        cartItems: cartItemsWithDiscount,
        discountPercent,
        setDiscountPercent,
        togglePercentDiscount,
        toggleItemDiscount,
        toggleVatExempt,
        discountAmount,
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
