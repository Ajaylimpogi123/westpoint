import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import React from "react";
import { DataTable } from "./Partials/DataTable";
import { columns } from "./Partials/Columns";

export default function Index({ sales = [] }) {
    const saleData = sales.map((sale) => ({
        id: sale.id,
        invoice_number: sale.invoice_number,
        created_at: sale.created_at,
        customer_name: sale.customer_name,
        gross_amount: sale.gross_amount,
        discount_amount: sale.discount_amount,
        net_amount: sale.net_amount,
        payment_method: sale.payment_method,
    }));

    return (
        <AuthenticatedLayout>
            <Head title="Transaction History" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-white">
                                    Transaction History
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-sm border bg-card text-card-foreground shadow">
                        <div className="p-6">
                            <DataTable columns={columns} data={saleData} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
