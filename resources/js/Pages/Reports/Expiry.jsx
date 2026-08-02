import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

function ExpiryStatus({ days }) {
    if (days < 0) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                Expired
            </span>
        );
    }

    if (days <= 30) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                Expiring Soon
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            OK
        </span>
    );
}

export default function Expiry({ filters, batches, branches }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Expiry Report</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Expiration
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Expiration report of products, including lot
                            numbers, expiry dates, and days left until
                            expiration.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.expiry"
                        filters={filters}
                        branchOptions={branches}
                        showDateRange={false}
                    />
                    <DataTable
                        columns={[
                            { key: "med_name", label: "Product" },
                            { key: "lot_number", label: "Lot #" },
                            {
                                key: "expiry",
                                label: "Expiry",
                                render: (r) => {
                                    if (!r.expiry) return "-";
                                    const d = new Date(r.expiry);
                                    return d.toLocaleDateString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    });
                                },
                            },
                            {
                                key: "status",
                                label: "Status",
                                render: (r) => (
                                    <ExpiryStatus days={r.days_to_expiry} />
                                ),
                            },
                            {
                                key: "days_to_expiry",
                                label: "Days Left",
                                render: (r) => (
                                    <span
                                        className={
                                            r.days_to_expiry < 0
                                                ? "text-red-600 font-semibold"
                                                : r.days_to_expiry <= 30
                                                  ? "text-orange-600 font-semibold"
                                                  : ""
                                        }
                                    >
                                        {r.days_to_expiry < 0
                                            ? `${Math.abs(r.days_to_expiry)} days ago`
                                            : r.days_to_expiry}
                                    </span>
                                ),
                            },
                            { key: "quantity", label: "Qty" },
                        ]}
                        rows={batches}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
