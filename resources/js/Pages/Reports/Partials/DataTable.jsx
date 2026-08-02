export default function DataTable({
    columns,
    rows,
    emptyMessage = "No records found.",
}) {
    return (
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="px-4 py-3 text-left font-semibold"
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 && (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-4 py-6 text-center text-gray-400"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                    {rows.map((row, i) => (
                        <tr
                            key={
                                row.id ??
                                row.log_id ??
                                row.stock_in_id ??
                                row.stock_out_id ??
                                i
                            }
                            className="hover:bg-slate-50"
                        >
                            {columns.map((col) => (
                                <td
                                    key={col.key}
                                    className="px-4 py-2.5 whitespace-nowrap"
                                >
                                    {col.render
                                        ? col.render(row)
                                        : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
