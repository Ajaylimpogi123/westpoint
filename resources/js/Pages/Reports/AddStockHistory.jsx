import { Link } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

const describeMedicine = (row) =>
    [row.dose, row.form, row.brand_name ? `(${row.brand_name})` : null]
        .filter(Boolean)
        .join(" ");

export default function AddStockHistory({ filters, logs, branches }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold">Add Stock History</h2>
            }
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Add Stock History
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Stock added manually from Medicine Inventory (Add
                            Stock), by branch, lot, and who added it. Supplier
                            deliveries are in the Stock In report.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.add-stock-history"
                        filters={filters}
                        branchOptions={branches}
                        searchPlaceholder="Medicine, brand, or lot #"
                    />
                    <DataTable
                        columns={[
                            { key: "created_at", label: "Date" },
                            { key: "branch_name", label: "Branch" },
                            {
                                key: "medicine_name",
                                label: "Medicine",
                                render: (row) => (
                                    <div>
                                        <div className="font-medium">
                                            {row.medicine_name}
                                        </div>
                                        {describeMedicine(row) && (
                                            <div className="text-xs text-gray-500">
                                                {describeMedicine(row)}
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: "lot_number",
                                label: "Lot #",
                                render: (row) => row.lot_number || "-",
                            },
                            {
                                key: "expiry",
                                label: "Expiry",
                                render: (row) => row.expiry || "-",
                            },
                            {
                                key: "shelf_number",
                                label: "Shelf",
                                render: (row) => row.shelf_number || "-",
                            },
                            {
                                key: "entered",
                                label: "Entered",
                                render: (row) => row.entered || "-",
                            },
                            { key: "quantity", label: "Pieces Added" },
                            {
                                key: "performed_by_name",
                                label: "Added By",
                                render: (row) =>
                                    row.performed_by_name || "System",
                            },
                        ]}
                        rows={logs.data}
                        emptyMessage="No stock was added in this period."
                    />
                    <div className="flex gap-2 mt-4 justify-center">
                        {logs.links.map((link, i) => (
                            <Link
                                key={i}
                                href={link.url || "#"}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className={`px-3 py-1 rounded text-sm ${link.active ? "bg-slate-800 text-white" : "bg-white text-slate-600"} ${!link.url && "opacity-40 pointer-events-none"}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
