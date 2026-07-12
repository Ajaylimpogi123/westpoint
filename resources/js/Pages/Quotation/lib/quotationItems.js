const BLANK_ITEM = {
    _clientId: "",
    product_id: null,
    _medicineMeta: null,
    qt_qty: 1,
    qt_unit: "",
    qt_description: "",
    lot_number: "",
    expiry_date: "",
    qt_unit_price: "",
};

function createClientId() {
    return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random()}`;
}

export function createBlankItem() {
    return {
        ...BLANK_ITEM,
        _clientId: createClientId(),
    };
}

export function addItem(items) {
    return [...items, createBlankItem()];
}

export function removeItem(items, index) {
    if (items.length === 1) return items;
    return items.filter((_, i) => i !== index);
}

export function updateItem(items, index, field, value) {
    return items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
    );
}

export function applyMedicineToItem(items, index, detail) {
    const primaryLot = detail.primary_lot ?? detail.lots?.[0] ?? null;

    return items.map((item, i) =>
        i === index
            ? {
                  ...item,
                  product_id: detail.id,
                  qt_description: detail.description,
                  qt_unit: detail.default_unit ?? "PIECE",
                  qt_unit_price: detail.default_price ?? detail.retail_price ?? "",
                  lot_number: primaryLot?.lot_number ?? "",
                  expiry_date: primaryLot?.expiry?.slice(0, 10) ?? "",
                  _medicineMeta: {
                      retail_price: detail.retail_price,
                      wholesale_price: detail.wholesale_price,
                      lots: detail.lots ?? [],
                  },
              }
            : item,
    );
}

export function setItemUnit(items, index, unit) {
    return items.map((item, i) => {
        if (i !== index) return item;

        const meta = item._medicineMeta;
        const suggestedPrice =
            unit === "BXS"
                ? meta?.wholesale_price ?? item.qt_unit_price
                : meta?.retail_price ?? item.qt_unit_price;

        return {
            ...item,
            qt_unit: unit,
            qt_unit_price: suggestedPrice ?? "",
        };
    });
}

export function setItemLot(items, index, lot) {
    return items.map((item, i) =>
        i === index
            ? {
                  ...item,
                  lot_number: lot.lot_number ?? "",
                  expiry_date: lot.expiry?.slice(0, 10) ?? "",
              }
            : item,
    );
}

export function stripClientFields(items) {
    return items.map(
        ({ _clientId, product_id, _medicineMeta, ...item }) => item,
    );
}

export function calculateAmount(item) {
    return (
        (parseFloat(item.qt_qty) || 0) * (parseFloat(item.qt_unit_price) || 0)
    );
}

export function calculateTotal(items) {
    return items.reduce((sum, item) => sum + calculateAmount(item), 0);
}
