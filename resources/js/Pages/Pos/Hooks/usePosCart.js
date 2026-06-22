import { useCallback, useMemo, useState } from "react";
import { getLineTotal, getUnitPrice } from "../lib/pricing";

function createCartKey(productId, unitType) {
    return `${productId}-${unitType}`;
}

export function usePosCart() {
    const [cartItems, setCartItems] = useState([]);
    const [discount, setDiscount] = useState(0);

    const addToCart = useCallback((product, unitType = "Piece") => {
        setCartItems((current) => {
            const existingIndex = current.findIndex(
                (item) =>
                    item.product.id === product.id &&
                    item.unitType === unitType,
            );

            if (existingIndex >= 0) {
                return current.map((item, index) => {
                    if (index !== existingIndex) {
                        return item;
                    }

                    const quantity = item.quantity + 1;

                    return {
                        ...item,
                        quantity,
                        priceUsed: getUnitPrice(product, unitType),
                        totalPrice: getLineTotal(product, unitType, quantity),
                    };
                });
            }

            return [
                ...current,
                {
                    key: createCartKey(product.id, unitType),
                    product,
                    unitType,
                    quantity: 1,
                    priceUsed: getUnitPrice(product, unitType),
                    totalPrice: getLineTotal(product, unitType, 1),
                },
            ];
        });
    }, []);

    const removeFromCart = useCallback((key) => {
        setCartItems((current) => current.filter((item) => item.key !== key));
    }, []);

    const updateQuantity = useCallback((key, change) => {
        setCartItems((current) =>
            current
                .map((item) => {
                    if (item.key !== key) {
                        return item;
                    }

                    const quantity = Math.max(1, item.quantity + change);

                    return {
                        ...item,
                        quantity,
                        priceUsed: getUnitPrice(item.product, item.unitType),
                        totalPrice: getLineTotal(
                            item.product,
                            item.unitType,
                            quantity,
                        ),
                    };
                })
                .filter((item) => item.quantity > 0),
        );
    }, []);

    const updateUnitType = useCallback((key, unitType) => {
        setCartItems((current) => {
            const target = current.find((item) => item.key === key);

            if (!target) {
                return current;
            }

            const withoutTarget = current.filter((item) => item.key !== key);
            const newKey = createCartKey(target.product.id, unitType);
            const existingIndex = withoutTarget.findIndex(
                (item) => item.key === newKey,
            );

            const updatedItem = {
                ...target,
                key: newKey,
                unitType,
                priceUsed: getUnitPrice(target.product, unitType),
                totalPrice: getLineTotal(
                    target.product,
                    unitType,
                    target.quantity,
                ),
            };

            if (existingIndex >= 0) {
                return withoutTarget.map((item, index) => {
                    if (index !== existingIndex) {
                        return item;
                    }

                    const quantity = item.quantity + updatedItem.quantity;

                    return {
                        ...item,
                        quantity,
                        priceUsed: getUnitPrice(item.product, unitType),
                        totalPrice: getLineTotal(
                            item.product,
                            unitType,
                            quantity,
                        ),
                    };
                });
            }

            return [...withoutTarget, updatedItem];
        });
    }, []);

    const clearCart = useCallback(() => {
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
    };
}
