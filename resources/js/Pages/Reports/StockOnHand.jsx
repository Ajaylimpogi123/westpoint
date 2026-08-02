import { router } from "@inertiajs/react";
import { useState } from "react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import DataTable from "./Partials/DataTable";

export default function StockOnHand({ stock, filters, branches }) {
    const [form, setForm] = useState({
        branch_id: filters?.branch_id || "",
        brand_name: filters?.brand_name || "",
        lot_number: filters?.lot_number || "",
        shelf_number: filters?.shelf_number || "",
        expiry_from: filters?.expiry_from || "",
        expiry_to: filters?.expiry_to || "",
    });

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        const query = Object.fromEntries(
            Object.entries(form).filter(([, v]) => v !== ""),
        );
        router.get(route("reports.stock-on-hand"), query, {
            preserveState: true,
            replace: true,
        });
    };

    const reset = () => {
        setForm({
            branch_id: "",
            brand_name: "",
            lot_number: "",
            shelf_number: "",
            expiry_from: "",
            expiry_to: "",
        });
        router.get(
            route("reports.stock-on-hand"),
            {},
            { preserveState: true, replace: true },
        );
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Stock on Hand</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 rounded-2xl text-white shadow-sm">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock on Hand Report
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Overview of stock on hand, including product
                            details, Lot #, quantities, and expiry information.
                        </p>
                    </div>
                    <form
                        onSubmit={submit}
                        className="flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg shadow-sm"
                    >
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

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Brand
                            </label>
                            <input
                                type="text"
                                value={form.brand_name}
                                onChange={set("brand_name")}
                                placeholder="e.g. Biogesic"
                                className="border-gray-300 rounded-md text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Lot #
                            </label>
                            <input
                                type="text"
                                value={form.lot_number}
                                onChange={set("lot_number")}
                                className="border-gray-300 rounded-md text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Shelf
                            </label>
                            <input
                                type="text"
                                value={form.shelf_number}
                                onChange={set("shelf_number")}
                                className="border-gray-300 rounded-md text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Expiry From
                            </label>
                            <input
                                type="date"
                                value={form.expiry_from}
                                onChange={set("expiry_from")}
                                className="border-gray-300 rounded-md text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Expiry To
                            </label>
                            <input
                                type="date"
                                value={form.expiry_to}
                                onChange={set("expiry_to")}
                                className="border-gray-300 rounded-md text-sm"
                            />
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
                            { key: "med_name", label: "Product" },
                            { key: "brand_name", label: "Brand" },
                            { key: "lot_number", label: "Lot #" },
                            { key: "expiry", label: "Expiry" },
                            { key: "shelf_number", label: "Shelf" },
                            { key: "quantity", label: "Qty" },
                            { key: "branch_name", label: "Branch" },
                        ]}
                        rows={stock}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
