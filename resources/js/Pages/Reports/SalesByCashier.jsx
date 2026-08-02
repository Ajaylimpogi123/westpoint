import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function SalesByCashier({ filters, cashiers, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Sales by Cashier</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Sales by Cashier
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Sales report by cashier, including transaction
                            counts and net amounts.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.sales-by-cashier"
                        filters={filters}
                        branchOptions={branches}
                    />
                    <DataTable
                        columns={[
                            { key: "cashier_name", label: "Cashier" },
                            { key: "transaction_count", label: "Transactions" },
                            {
                                key: "net_amount",
                                label: "Net",
                                render: (r) =>
                                    `₱${Number(r.net_amount).toLocaleString()}`,
                            },
                        ]}
                        rows={cashiers}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
