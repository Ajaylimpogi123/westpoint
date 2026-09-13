import { Link } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

const formatCurrency = (value) =>
    `₱${Number(value ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export default function VoidReturns({ filters, items, totals, branches }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold">Void / Return Items</h2>
            }
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Void / Return Items
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Every item voided or returned from a completed sale,
                            including quantity, refund amount, and reason.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white bg-white p-5">
                            <span className="text-xs font-medium uppercase tracking-widest text-black">
                                Returns Processed
                            </span>
                            <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                                {Number(
                                    totals?.return_count ?? 0,
                                ).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white bg-white p-5">
                            <span className="text-xs font-medium uppercase tracking-widest text-black">
                                Items Returned
                            </span>
                            <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                                {Number(
                                    totals?.items_returned ?? 0,
                                ).toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white bg-white p-5">
                            <span className="text-xs font-medium uppercase tracking-widest text-black">
                                Total Refunded
                            </span>
                            <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                                {formatCurrency(totals?.total_refunded)}
                            </p>
                        </div>
                    </div>

                    <ReportFilterBar
                        routeName="reports.void-returns"
                        filters={filters}
                        branchOptions={branches}
                    />

                    <DataTable
                        columns={[
                            { key: "invoice_number", label: "Invoice #" },
                            { key: "med_name", label: "Product" },
                            {
                                key: "brand_name",
                                label: "Brand",
                                render: (r) => r.brand_name || "—",
                            },
                            { key: "unit_type", label: "Unit" },
                            {
                                key: "quantity_returned",
                                label: "Qty Returned",
                            },
                            {
                                key: "refund_amount",
                                label: "Refund",
                                render: (r) => formatCurrency(r.refund_amount),
                            },
                            {
                                key: "reason",
                                label: "Reason",
                                render: (r) => r.reason || "—",
                            },
                            {
                                key: "received_by",
                                label: "Received By",
                                render: (r) => r.received_by || "—",
                            },
                            {
                                key: "processed_by_name",
                                label: "Processed By",
                                render: (r) => r.processed_by_name || "—",
                            },
                            {
                                key: "branch_name",
                                label: "Branch",
                                render: (r) => r.branch_name || "—",
                            },
                            {
                                key: "created_at",
                                label: "Date",
                                render: (r) =>
                                    new Date(r.created_at).toLocaleString(
                                        undefined,
                                        {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                            hour: "numeric",
                                            minute: "2-digit",
                                        },
                                    ),
                            },
                        ]}
                        rows={items.data}
                        emptyMessage="No voided or returned items in this period."
                    />

                    <div className="flex gap-2 mt-4 justify-center">
                        {items.links.map((link, i) => (
                            <Link
                                key={i}
                                href={link.url || "#"}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className={`px-3 py-1 rounded text-sm ${
                                    link.active
                                        ? "bg-slate-800 text-white"
                                        : "bg-white text-slate-600"
                                } ${!link.url && "opacity-40 pointer-events-none"}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
