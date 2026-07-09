const TONE_CLASSES = {
    danger: "bg-red-100 text-red-800",
    warning: "bg-orange-100 text-orange-800",
    success: "bg-green-100 text-green-800",
};

export function getPosStockStatus(totalStock, packSize) {
    const stock = Number(totalStock) || 0;
    const pack = Number(packSize) || 1;
    const lowThreshold = pack * 2;

    if (stock === 0) {
        return { label: "Out of Stock", tone: "danger" };
    }

    if (stock <= lowThreshold) {
        return { label: "Low Stock", tone: "warning" };
    }

    return { label: "In Stock", tone: "success" };
}

export function getStockStatusBadgeClass(tone) {
    return TONE_CLASSES[tone] ?? TONE_CLASSES.success;
}

export function getUnitPrice(product, unitType) {
    if (unitType === "Box") {
        return Number(product.wholesale_price) || 0;
    }

    return Number(product.retail_price) || 0;
}

export function getLineTotal(product, unitType, quantity) {
    return getUnitPrice(product, unitType) * (Number(quantity) || 0);
}

export function getPiecesRequired(product, unitType, quantity) {
    const qty = Number(quantity) || 0;

    if (unitType === "Box") {
        return qty * (Number(product.pack_size) || 1);
    }

    return qty;
}

export function getProductTotalStock(product) {
    return Number(product?.total_stock ?? product?.totalStock) || 0;
}

export function getPiecesInCart(cartItems, productId, excludeKey = null) {
    return cartItems
        .filter(
            (item) =>
                item.product.id === productId && item.key !== excludeKey,
        )
        .reduce(
            (sum, item) =>
                sum + getPiecesRequired(item.product, item.unitType, item.quantity),
            0,
        );
}

export function getMaxQuantity(product, unitType, cartItems, excludeKey = null) {
    const totalStock = getProductTotalStock(product);
    const usedPieces = getPiecesInCart(cartItems, product.id, excludeKey);
    const remainingPieces = Math.max(totalStock - usedPieces, 0);
    const packSize = Number(product.pack_size) || 1;

    if (unitType === "Box") {
        return Math.floor(remainingPieces / packSize);
    }

    return remainingPieces;
}

export function normalizeCartQuantityInput(rawValue, maxQty) {
    const trimmed = String(rawValue ?? "").trim();

    if (trimmed === "" || trimmed === "0") {
        return 1;
    }

    const parsed = Math.floor(Number(trimmed));

    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }

    const cap = Math.max(Number(maxQty) || 0, 1);

    return Math.min(parsed, cap);
}

export function canAddToCart(product, unitType, cartItems, quantityToAdd = 1) {
    const existing = cartItems.find(
        (item) => item.product.id === product.id && item.unitType === unitType,
    );
    const currentQty = existing?.quantity ?? 0;
    const maxQty = getMaxQuantity(product, unitType, cartItems, existing?.key);

    return currentQty + quantityToAdd <= maxQty;
}

export function formatCurrency(amount) {
    return `₱${Number(amount || 0).toFixed(2)}`;
}
