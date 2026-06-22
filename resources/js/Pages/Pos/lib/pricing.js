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

export function formatCurrency(amount) {
    return `₱${Number(amount || 0).toFixed(2)}`;
}
