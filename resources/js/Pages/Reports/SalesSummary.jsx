import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";
import SalesSummaryCards from "./Partials/SalesSummaryCards";
import PaymentMethodBreakdownChart from "./Partials/PaymentMethodBreakdownChart";
import SalesByDayChart from "./Partials/SalesByDayChart";

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
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Sales Summary
                        </h1>
                        <p className="mt-2 text-md text-white">
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

                    <SalesSummaryCards
                        totals={{
                            transaction_count: totals.transaction_count,
                            gross_total: totals.gross_amount,
                            discount_total: totals.discount_amount,
                            net_total: totals.net_amount,
                        }}
                    />

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <PaymentMethodBreakdownChart
                            breakdown={byPaymentMethod}
                        />
                        <SalesByDayChart byDay={byDay} />
                    </div>

                    <div>
                        <h3 className="text-xs font-semibold text-[#8C93A5] uppercase tracking-widest mb-3">
                            By Payment Method
                        </h3>
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

                    <div>
                        <h3 className="text-xs font-semibold text-[#8C93A5] uppercase tracking-widest mb-3">
                            By Day
                        </h3>
                        <DataTable
                            columns={[
                                { key: "sale_date", label: "Date" },
                                {
                                    key: "transaction_count",
                                    label: "Transactions",
                                },
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
            </div>
        </AuthenticatedLayout>
    );
}
