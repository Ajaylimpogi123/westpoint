import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function SalesSummary({
    filters,
    data,
    branches,
    paymentMethods,
}) {
    const { totals, byPaymentMethod, byDay } = data;

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Sales Summary</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Sales Summary
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Overview of sales performance, including transaction
                            counts, revenue, and payment method breakdown.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.sales-summary"
                        filters={filters}
                        branchOptions={branches}
                        paymentMethodOptions={paymentMethods}
                    />

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 relative z-10">
                        {[
                            ["Transactions", totals.transaction_count],
                            [
                                "Gross",
                                `₱${Number(totals.gross_amount).toLocaleString()}`,
                            ],
                            [
                                "Discounts",
                                `₱${Number(totals.discount_amount).toLocaleString()}`,
                            ],
                            [
                                "Net",
                                `₱${Number(totals.net_amount).toLocaleString()}`,
                            ],
                        ].map(([label, value]) => (
                            <div
                                key={label}
                                className="bg-white rounded-lg shadow-sm p-4"
                            >
                                <div className="text-xs text-slate-500 uppercase">
                                    {label}
                                </div>
                                <div className="text-xl font-semibold text-slate-800">
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>

                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">
                        By Payment Method
                    </h3>
                    <div className="mb-6">
                        <DataTable
                            columns={[
                                { key: "payment_method", label: "Method" },
                                { key: "count", label: "Transactions" },
                                {
                                    key: "total",
                                    label: "Total",
                                    render: (r) =>
                                        `₱${Number(r.total).toLocaleString()}`,
                                },
                            ]}
                            rows={byPaymentMethod}
                        />
                    </div>

                    <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">
                        By Day
                    </h3>
                    <DataTable
                        columns={[
                            { key: "sale_date", label: "Date" },
                            { key: "transaction_count", label: "Transactions" },
                            {
                                key: "net_amount",
                                label: "Net",
                                render: (r) =>
                                    `₱${Number(r.net_amount).toLocaleString()}`,
                            },
                        ]}
                        rows={byDay}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
