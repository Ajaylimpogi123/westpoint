import { router } from "@inertiajs/react";
import { useState } from "react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";

import DataTable from "./Partials/DataTable";

export default function StockTransfers({ filters, transfers }) {
    const [form, setForm] = useState({
        date_from: filters?.date_from || "",
        date_to: filters?.date_to || "",
        status: filters?.status || "",
    });

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        const query = Object.fromEntries(
            Object.entries(form).filter(([, v]) => v !== ""),
        );
        router.get(route("reports.stock-transfers"), query, {
            preserveState: true,
            replace: true,
        });
    };

    const reset = () => {
        setForm({ date_from: "", date_to: "", status: "" });
        router.get(
            route("reports.stock-transfers"),
            {},
            { preserveState: true, replace: true },
        );
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Stock Transfers</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock Transfers Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Overview of stock transfers, including transfer
                            numbers, source and destination branches, statuses,
                            and dates.
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
                                Status
                            </label>
                            <select
                                value={form.status}
                                onChange={set("status")}
                                className="border-gray-300 rounded-md text-sm"
                            >
                                <option value="">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="cancelled">Cancelled</option>
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
                            { key: "transfer_no", label: "Transfer #" },
                            { key: "from_branch", label: "From" },
                            { key: "to_branch", label: "To" },
                            {
                                key: "status",
                                label: "Status",
                                render: (r) => (
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            r.status === "approved"
                                                ? "bg-green-100 text-green-800"
                                                : r.status === "pending"
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-red-100 text-red-800"
                                        }`}
                                    >
                                        {r.status === "approved"
                                            ? "Approved"
                                            : r.status === "pending"
                                              ? "Pending"
                                              : "Rejected"}
                                    </span>
                                ),
                            },
                            { key: "priority", label: "Priority" },
                            { key: "requested_by_name", label: "Requested By" },
                            { key: "approved_by_name", label: "Approved By" },
                            {
                                key: "transfer_date",
                                label: "Date",
                                render: (r) =>
                                    new Date(
                                        r.transfer_date,
                                    ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                    }),
                            },
                        ]}
                        rows={transfers}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
