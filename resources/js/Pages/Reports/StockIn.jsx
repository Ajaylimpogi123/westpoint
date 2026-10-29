import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";
import MovementTotals, { medicineColumn } from "./Partials/MovementTotals";

export default function StockIn({ filters, items, totals, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Stock In</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock In Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Supplier deliveries received into each branch, by
                            delivery date. Manual Add Stock entries are in the
                            Add Stock History report.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.stock-in"
                        filters={filters}
                        branchOptions={branches}
                        showSupplierName={true}
                    />
                    <MovementTotals
                        items={[
                            { label: "Transactions", value: totals.transactions },
                            { label: "Line items", value: totals.lines },
                            {
                                label: "Pieces received",
                                value: totals.pieces,
                                hint: "Added to stock",
                            },
                        ]}
                    />
                    <DataTable
                        columns={[
                            {
                                key: "stock_in_id",
                                label: "Ref #",
                                render: (r) => `SI-${r.stock_in_id}`,
                            },
                            { key: "delivery_date", label: "Date" },
                            { key: "branch_name", label: "Branch" },
                            medicineColumn,
                            { key: "batch_number", label: "Lot #" },
                            { key: "expiry_date", label: "Expiry" },
                            {
                                key: "quantity_received",
                                label: "Qty",
                                render: (r) =>
                                    `${r.quantity_received} ${r.unit_type ?? ""}`,
                            },
                            { key: "pieces_received", label: "Pieces" },
                            { key: "supplier_name", label: "Supplier" },
                            { key: "received_by", label: "Received By" },
                        ]}
                        rows={items}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
