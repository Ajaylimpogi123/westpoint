import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function TopProducts({ filters, products, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Top Products</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Top Products Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Overview of Top Products, including product details,
                            units sold, and revenue generated.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.top-products"
                        filters={filters}
                        branchOptions={branches}
                    />
                    <DataTable
                        columns={[
                            { key: "med_name", label: "Product" },
                            { key: "brand_name", label: "Brand" },
                            { key: "units_sold", label: "Units Sold" },
                            {
                                key: "revenue",
                                label: "Revenue",
                                render: (r) =>
                                    `₱${Number(r.revenue).toLocaleString()}`,
                            },
                        ]}
                        rows={products}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
