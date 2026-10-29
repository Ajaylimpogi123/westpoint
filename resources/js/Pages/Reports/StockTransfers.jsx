import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";
import MovementTotals, { medicineColumn } from "./Partials/MovementTotals";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
];

const STATUS_STYLES = {
    approved: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
};

const capitalize = (value) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : "-";

export default function StockTransfers({ filters, transfers, totals, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Stock Transfers</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock Transfers Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Stock moved between branches, by transfer date.
                            Stock moves only when a request is approved; the
                            branch filter matches either side of a transfer.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.stock-transfers"
                        filters={filters}
                        branchOptions={branches}
                        statusOptions={STATUS_OPTIONS}
                    />
                    <MovementTotals
                        items={[
                            { label: "Transfers", value: totals.transfers },
                            { label: "Line items", value: totals.lines },
                            {
                                label: "Pieces moved",
                                value: totals.pieces,
                                hint: "Approved transfers",
                            },
                            {
                                label: "Pending pieces",
                                value: totals.pending_pieces,
                                hint: "Awaiting approval",
                            },
                        ]}
                    />
                    <DataTable
                        columns={[
                            { key: "transfer_no", label: "Ref #" },
                            { key: "transfer_date", label: "Date" },
                            {
                                key: "route",
                                label: "From → To",
                                render: (r) =>
                                    `${r.from_branch ?? "-"} → ${r.to_branch ?? "-"}`,
                            },
                            medicineColumn,
                            {
                                key: "lot_number",
                                label: "Lot #",
                                render: (r) => r.lot_number || "-",
                            },
                            {
                                key: "expiry",
                                label: "Expiry",
                                render: (r) => r.expiry || "-",
                            },
                            {
                                key: "quantity_requested",
                                label: "Requested",
                                render: (r) =>
                                    r.quantity_requested != null
                                        ? `${r.quantity_requested} pcs`
                                        : "-",
                            },
                            {
                                key: "moved_pieces",
                                label: "Moved",
                                render: (r) => `${r.moved_pieces} pcs`,
                            },
                            {
                                key: "status",
                                label: "Status",
                                render: (r) => (
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? ""}`}
                                    >
                                        {capitalize(r.status)}
                                    </span>
                                ),
                            },
                            {
                                key: "priority",
                                label: "Priority",
                                render: (r) => capitalize(r.priority),
                            },
                            { key: "requested_by_name", label: "Requested By" },
                            {
                                key: "actioned_by_name",
                                label: "Actioned By",
                                render: (r) => r.actioned_by_name || "-",
                            },
                        ]}
                        rows={transfers}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
