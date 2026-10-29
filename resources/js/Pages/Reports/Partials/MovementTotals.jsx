/**
 * Summary strip shown above the Stock In / Stock Out tables so both reports
 * report the same figures (transactions, lines, pieces) in the same place.
 */
export default function MovementTotals({ items }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="rounded-lg bg-white p-4 shadow-sm"
                >
                    <div className="text-xs font-medium uppercase text-gray-500">
                        {item.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-800">
                        {Number(item.value ?? 0).toLocaleString()}
                    </div>
                    {item.hint && (
                        <div className="mt-0.5 text-xs text-gray-400">
                            {item.hint}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export const describeMedicine = (row) =>
    [row.dose, row.form, row.brand_name ? `(${row.brand_name})` : null]
        .filter(Boolean)
        .join(" ");

export const medicineColumn = {
    key: "med_name",
    label: "Product",
    render: (row) => (
        <div>
            <div className="font-medium">{row.med_name}</div>
            {describeMedicine(row) && (
                <div className="text-xs text-gray-500">
                    {describeMedicine(row)}
                </div>
            )}
        </div>
    ),
};
