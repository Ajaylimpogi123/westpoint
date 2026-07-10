import { Head, Link, router } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import StatusBadge from "./Partials/StatusBadge";
import {
    STATUS_CONFIRMATIONS,
    STATUS_TRANSITIONS,
    formatCurrency,
} from "./lib/quotationStatus";
import { formatCustomerName } from "./lib/customerName";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Show({ quotation }) {
    function setStatus(status) {
        if (!confirm(STATUS_CONFIRMATIONS[status])) return;
        router.patch(route("quotations.status", quotation.id), { status });
    }

    function destroy() {
        if (!confirm("Delete this draft quotation? This cannot be undone."))
            return;
        router.delete(route("quotations.destroy", quotation.id));
    }

    const transitions = STATUS_TRANSITIONS[quotation.status] ?? [];

    return (
        <AuthenticatedLayout>
            <Head title={quotation.qt_no} />

            <div className="mx-auto max-w-6xl px-4 py-8 relative z-10">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold text-white">
                                {quotation.qt_no}
                            </h1>
                            <StatusBadge status={quotation.status} />
                        </div>
                        <p className="text-md text-white">
                            {formatCustomerName(quotation.customer)}
                        </p>
                    </div>
                    <Link href={route("quotations.index")}>
                        <Button size="sm" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back to list
                        </Button>
                    </Link>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-4">
                    <div>
                        <div className="text-slate-400">S.I.D. No.</div>
                        <div className="font-medium text-slate-700">
                            {quotation.sid_no || "—"}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400">Date</div>
                        <div className="font-medium text-slate-700">
                            {quotation.qt_date?.slice(0, 10)}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400">Delivery</div>
                        <div className="font-medium capitalize text-slate-700">
                            {quotation.delivery_type}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400">Total</div>
                        <div className="font-medium text-slate-700">
                            ₱ {formatCurrency(quotation.total_amount)}
                        </div>
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                        <div className="text-slate-400">Address</div>
                        <div className="font-medium text-slate-700">
                            {quotation.address || "—"}
                        </div>
                    </div>
                    {quotation.qt_remarks && (
                        <div className="col-span-2 sm:col-span-4">
                            <div className="text-slate-400">Remarks</div>
                            <div className="font-medium text-slate-700">
                                {quotation.qt_remarks}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2">Qty</th>
                                <th className="px-3 py-2">Unit</th>
                                <th className="px-3 py-2">Description</th>
                                <th className="px-3 py-2">Lot No.</th>
                                <th className="px-3 py-2">Expiry</th>
                                <th className="px-3 py-2 text-right">
                                    Unit Price
                                </th>
                                <th className="px-3 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {quotation.items.map((item) => (
                                <tr key={item.id}>
                                    <td className="px-3 py-2">{item.qt_qty}</td>
                                    <td className="px-3 py-2">
                                        {item.qt_unit || "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                        {item.qt_description}
                                    </td>
                                    <td className="px-3 py-2">
                                        {item.lot_number || "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                        {item.expiry_date
                                            ? item.expiry_date.slice(0, 10)
                                            : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {formatCurrency(item.qt_unit_price)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">
                                        {formatCurrency(item.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-3 py-2 text-right text-sm font-medium text-slate-500"
                                >
                                    Total
                                </td>
                                <td className="px-3 py-2 text-right text-base font-semibold text-slate-800">
                                    {formatCurrency(quotation.total_amount)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        {quotation.status === "draft" && (
                            <Link
                                href={route("quotations.edit", quotation.id)}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                Edit
                            </Link>
                        )}

                        {transitions.map((t) => (
                            <button
                                key={t.status}
                                onClick={() => setStatus(t.status)}
                                className={`rounded-lg px-3 py-2 text-sm font-medium ${t.className}`}
                            >
                                {t.label}
                            </button>
                        ))}

                        {quotation.status === "draft" && (
                            <button
                                onClick={destroy}
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                                Delete
                            </button>
                        )}
                    </div>

                    <a
                        href={route("quotations.print", quotation.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
                    >
                        Print Slip
                    </a>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
