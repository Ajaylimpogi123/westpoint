import { Link } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function SalesDetail({
    filters,
    sales,
    branches,
    paymentMethods,
}) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Sales Detail</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Sales Detail
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Sales detail report of transactions, including
                            invoice numbers, customer names, payment methods,
                            net amounts, cashiers, branches, and dates.
                        </p>
                    </div>
                    <div className="flex justify-between items-end mb-4">
                        <ReportFilterBar
                            routeName="reports.sales-detail"
                            filters={filters}
                            branchOptions={branches}
                            paymentMethodOptions={paymentMethods}
                        />

                        <a
                            href={route("reports.sales-detail.export", filters)}
                            className="text-sm text-slate-800 border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50"
                        >
                            Export CSV
                        </a>
                    </div>

                    <DataTable
                        columns={[
                            { key: "invoice_number", label: "Invoice #" },
                            {
                                key: "reference_number",
                                label: "Reference #",
                                render: (r) => r.reference_number || "N/A",
                            },
                            {
                                key: "customer_name",
                                label: "Customer",
                                render: (r) => r.customer_name || "Walk-in",
                            },
                            { key: "payment_method", label: "Payment" },
                            {
                                key: "net_amount",
                                label: "Net",
                                render: (r) =>
                                    `₱${Number(r.net_amount).toLocaleString()}`,
                            },
                            { key: "cashier_name", label: "Cashier" },
                            { key: "branch_name", label: "Branch" },
                            {
                                key: "created_at",
                                label: "Date",
                                render: (r) =>
                                    new Date(r.created_at).toLocaleDateString(
                                        undefined,
                                        {
                                            year: "numeric",
                                            month: "long",
                                            day: "numeric",
                                        },
                                    ),
                            },
                        ]}
                        rows={sales.data}
                    />

                    <div className="flex gap-2 mt-4 justify-center">
                        {sales.links.map((link, i) => (
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
