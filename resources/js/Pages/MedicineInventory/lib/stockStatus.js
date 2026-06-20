const TONE_CLASSES = {
    danger: "bg-red-100 text-red-800",
    warning: "bg-orange-100 text-orange-800",
    success: "bg-green-100 text-green-800",
};

export function isPastExpiry(expiry) {
    if (!expiry) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiryDate = new Date(expiry);
    expiryDate.setHours(0, 0, 0, 0);

    return expiryDate < today;
}

export function getMedicineStockStatus(totalStock, packSize) {
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

export function getBatchStockStatus(quantity, expiry) {
    if (isPastExpiry(expiry)) {
        return { label: "Expired", tone: "danger" };
    }

    const stock = Number(quantity) || 0;

    if (stock === 0) {
        return { label: "Empty", tone: "danger" };
    }

    return { label: "Available", tone: "success" };
}

export function getStockStatusBadgeClass(tone) {
    return TONE_CLASSES[tone] ?? TONE_CLASSES.success;
}
