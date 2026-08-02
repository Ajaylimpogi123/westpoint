import { router } from "@inertiajs/react";
import { useState } from "react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

import DataTable from "./Partials/DataTable";

export default function StockOut({ filters, items, branches }) {
    const [form, setForm] = useState({
        date_from: filters?.date_from || "",
        date_to: filters?.date_to || "",
        branch_id: filters?.branch_id || "",
    });

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        const query = Object.fromEntries(
            Object.entries(form).filter(([, v]) => v !== ""),
        );
        router.get(route("reports.stock-out"), query, {
            preserveState: true,
            replace: true,
        });
    };

    const reset = () => {
        setForm({ date_from: "", date_to: "", branch_id: "" });
        router.get(
            route("reports.stock-out"),
            {},
            { preserveState: true, replace: true },
        );
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Stock Out</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock Out Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Overview of stock out, including product details,
                            Lot # and quantities.
                        </p>
                    </div>
                    <form
                        onSubmit={submit}
                        className="flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg shadow-sm"
                    >
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                From
                            </label>
                            <input
                                type="date"
                                value={form.date_from}
                                onChange={set("date_from")}
                                className="border-gray-300 rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                To
                            </label>
                            <input
                                type="date"
                                value={form.date_to}
                                onChange={set("date_to")}
                                className="border-gray-300 rounded-md text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Branch
                            </label>
                            <select
                                value={form.branch_id}
                                onChange={set("branch_id")}
                                className="border-gray-300 rounded-md text-sm"
                            >
                                <option value="">All branches</option>
                                {branches?.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="bg-slate-800 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-700"
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={reset}
                            className="text-sm text-slate-500 px-3 py-2 hover:text-slate-700"
                        >
                            Clear
                        </button>
                    </form>

                    <DataTable
                        columns={[
                            { key: "transaction_subtype", label: "Type" },
                            { key: "med_name", label: "Product" },
                            { key: "lot_number", label: "Lot #" },
                            { key: "quantity_deducted", label: "Qty" },
                            { key: "delivered_to", label: "Delivered To" },
                            {
                                key: "delivery_confirmed",
                                label: "Confirmed",
                                render: (r) =>
                                    r.delivery_confirmed ? "✅" : "—",
                            },
                            { key: "issued_by", label: "Issued By" },
                            { key: "created_at", label: "Date" },
                        ]}
                        rows={items}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
