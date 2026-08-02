import { Link } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import ReportFilterBar from "./Partials/ReportFilterBar";
import DataTable from "./Partials/DataTable";

export default function MovementLedger({ filters, logs, branches }) {
    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold">
                    Inventory Movement Ledger
                </h2>
            }
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Inventory Movement Ledger
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Inventory movement report of products, including lot
                            numbers, movement types, and dates.
                        </p>
                    </div>
                    <ReportFilterBar
                        routeName="reports.movement-ledger"
                        filters={filters}
                        branchOptions={branches}
                    />
                    <DataTable
                        columns={[
                            { key: "movement_type", label: "Type" },
                            { key: "medicine_name", label: "Product" },
                            { key: "lot_number", label: "Lot #" },
                            { key: "quantity", label: "Qty" },
                            { key: "reference_label", label: "Reference" },
                            { key: "performed_by_name", label: "By" },
                            { key: "created_at", label: "Date" },
                        ]}
                        rows={logs.data}
                    />
                    <div className="flex gap-2 mt-4 justify-center">
                        {logs.links.map((link, i) => (
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
