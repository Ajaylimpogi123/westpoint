const MOVEMENT_TYPE_LABELS = {
    medicine_added: "Medicine Added",
    medicine_updated: "Medicine Updated",
    medicine_deleted: "Medicine Deleted",
    medicine_auto_deleted: "Auto-Deactivated (Zero Stock)",
    medicine_reactivated: "Medicine Reactivated",
    stock_in: "Stock In",
    stock_out: "Stock Out",
    add_stock: "Add Stock",
    batch_updated: "Batch Updated",
    batch_deleted: "Batch Deleted",
};

export function getMovementTypeLabel(type) {
    return MOVEMENT_TYPE_LABELS[type] ?? type;
}

export function formatMovementQuantity(quantity) {
    if (quantity === null || quantity === undefined) {
        return "—";
    }

    const value = Number(quantity);

    if (value > 0) {
        return `+${value}`;
    }

    return String(value);
}
