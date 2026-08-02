import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function StockIn({ filters, items, branches }) {
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
                            Overview of stock in activities, including supplier
                            information, product details, and receipt dates.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.stock-in"
                        filters={filters}
                        branchOptions={branches}
                    />
                    <DataTable
                        columns={[
                            { key: "supplier_name", label: "Supplier" },
                            { key: "med_name", label: "Product" },
                            { key: "batch_number", label: "Batch #" },
                            { key: "expiry_date", label: "Expiry" },
                            { key: "unit_type", label: "Unit" },
                            { key: "quantity_received", label: "Qty Received" },
                            { key: "received_by", label: "Received By" },
                            { key: "delivery_date", label: "Date" },
                        ]}
                        rows={items}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
