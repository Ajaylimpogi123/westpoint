const BLANK_ITEM = {
    qt_qty: 1,
    qt_unit: "",
    qt_description: "",
    lot_number: "",
    expiry_date: "",
    qt_unit_price: "",
};

export function createBlankItem() {
    return { ...BLANK_ITEM };
}

export function addItem(items) {
    return [...items, createBlankItem()];
}

export function removeItem(items, index) {
    if (items.length === 1) return items; // always keep at least one row
    return items.filter((_, i) => i !== index);
}

export function updateItem(items, index, field, value) {
    return items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
    );
}

// Mirrors QuotationItem::boot() -> amount = qty * unit_price
export function calculateAmount(item) {
    return (
        (parseFloat(item.qt_qty) || 0) * (parseFloat(item.qt_unit_price) || 0)
    );
}

export function calculateTotal(items) {
    return items.reduce((sum, item) => sum + calculateAmount(item), 0);
}
