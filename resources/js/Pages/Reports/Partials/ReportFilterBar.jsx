import { router } from "@inertiajs/react";
import { useState } from "react";

/**
 * Generic date-range (+ optional status/branch/payment method) filter bar
 * shared across report pages. `routeName` is the current report's route;
 * submitting re-fetches with the new query string via Inertia's partial reload.
 */
export default function ReportFilterBar({
    routeName,
    filters = {},
    statusOptions = null,
    branchOptions = null,
    paymentMethodOptions = null,
    showDateRange = true,
    showSupplierName = false,
}) {
    const [form, setForm] = useState({
        supplier_name: filters.supplier_name || "",
        date_from: filters.date_from || "",
        date_to: filters.date_to || "",
        status: filters.status || "",
        branch_id: filters.branch_id || "",
        payment_method: filters.payment_method || "",
    });

    const submit = (e) => {
        e.preventDefault();
        const query = Object.fromEntries(
            Object.entries(form).filter(([, v]) => v !== ""),
        );
        router.get(route(routeName), query, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <form
            onSubmit={submit}
            className="flex flex-wrap items-end gap-3 mb-4 bg-white p-4 rounded-lg shadow-sm"
        >
            {showSupplierName && (
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Supplier Name
                    </label>
                    <input
                        type="text"
                        value={form.supplier_name}
                        onChange={(e) =>
                            setForm({ ...form, supplier_name: e.target.value })
                        }
                        placeholder="e.g. ABC Supplier"
                        className="border-gray-300 rounded-md text-sm"
                    />
                </div>
            )}

            {showDateRange && (
                <>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            From
                        </label>
                        <input
                            type="date"
                            value={form.date_from}
                            onChange={(e) =>
                                setForm({ ...form, date_from: e.target.value })
                            }
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
                            onChange={(e) =>
                                setForm({ ...form, date_to: e.target.value })
                            }
                            className="border-gray-300 rounded-md text-sm"
                        />
                    </div>
                </>
            )}

            {branchOptions && (
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Branch
                    </label>
                    <select
                        value={form.branch_id}
                        onChange={(e) =>
                            setForm({ ...form, branch_id: e.target.value })
                        }
                        className="border-gray-300 rounded-md text-sm"
                    >
                        <option value="">All Branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {paymentMethodOptions && (
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Payment Method
                    </label>
                    <select
                        value={form.payment_method}
                        onChange={(e) =>
                            setForm({ ...form, payment_method: e.target.value })
                        }
                        className="border-gray-300 rounded-md text-sm"
                    >
                        <option value="">All Methods</option>
                        {paymentMethodOptions.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {statusOptions && (
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Status
                    </label>
                    <select
                        value={form.status}
                        onChange={(e) =>
                            setForm({ ...form, status: e.target.value })
                        }
                        className="border-gray-300 rounded-md text-sm"
                    >
                        <option value="">All</option>
                        {statusOptions.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <button
                type="submit"
                className="bg-slate-800 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-700"
            >
                Apply
            </button>
        </form>
    );
}
