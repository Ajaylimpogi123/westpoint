import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";
import MovementTotals, { medicineColumn } from "./Partials/MovementTotals";

const STATUS_STYLES = {
    Deducted: "bg-slate-100 text-slate-700",
    Delivered: "bg-emerald-50 text-emerald-700",
    "Pending delivery": "bg-amber-50 text-amber-700",
};

export default function StockOut({ filters, items, totals, subtypes, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Stock Out</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock Out Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Stock issued from each branch, by date recorded. A
                            delivery to a customer takes stock only once it is
                            confirmed.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.stock-out"
                        filters={filters}
                        branchOptions={branches}
                        statusOptions={subtypes}
                        statusLabel="Type"
                    />
                    <MovementTotals
                        items={[
                            { label: "Transactions", value: totals.transactions },
                            { label: "Line items", value: totals.lines },
                            {
                                label: "Pieces deducted",
                                value: totals.pieces,
                                hint: "Removed from stock",
                            },
                            {
                                label: "Pending pieces",
                                value: totals.pending_pieces,
                                hint: "Deliveries not yet confirmed",
                            },
                        ]}
                    />
                    <DataTable
                        columns={[
                            {
                                key: "stock_out_id",
                                label: "Ref #",
                                render: (r) => `SO-${r.stock_out_id}`,
                            },
                            { key: "created_at", label: "Date" },
                            { key: "branch_name", label: "Branch" },
                            medicineColumn,
                            { key: "lot_number", label: "Lot #" },
                            { key: "expiry", label: "Expiry" },
                            {
                                key: "quantity_deducted",
                                label: "Qty",
                                render: (r) =>
                                    `${r.quantity_deducted} ${r.unit_type ?? ""}`,
                            },
                            { key: "pieces_deducted", label: "Pieces" },
                            { key: "transaction_subtype", label: "Type" },
                            {
                                key: "status",
                                label: "Status",
                                render: (r) => (
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? ""}`}
                                    >
                                        {r.status}
                                    </span>
                                ),
                            },
                            {
                                key: "delivered_to",
                                label: "Delivered To",
                                render: (r) => r.delivered_to || "-",
                            },
                            { key: "issued_by", label: "Issued By" },
                        ]}
                        rows={items}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
