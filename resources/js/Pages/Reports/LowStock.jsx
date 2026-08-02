import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function LowStock({ filters, products, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Low Stock</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Low Stocks
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Low stock report of products, including lot numbers,
                            current quantities, and stock thresholds.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.low-stock"
                        filters={filters}
                        branchOptions={branches}
                        showDateRange={false}
                    />
                    <DataTable
                        columns={[
                            { key: "med_name", label: "Product" },
                            { key: "brand_name", label: "Brand" },
                            { key: "total_quantity", label: "On Hand" },
                            { key: "stock_threshold", label: "Threshold" },
                        ]}
                        rows={products}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
