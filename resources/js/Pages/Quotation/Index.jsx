import { Head, Link, router } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import StatusBadge from "./Partials/StatusBadge";
import { formatCustomerName } from "./lib/customerName";
import { formatCurrency } from "./lib/quotationStatus";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 400;

export default function Index({ quotations, filters }) {
    const [search, setSearch] = useState(filters.search ?? "");
    const [status, setStatus] = useState(filters.status ?? "all");

    // Tracks whether the current `search` value came from the user typing
    // (and therefore needs to be debounced) vs. programmatic sync.
    const isFirstRender = useRef(true);
    const debounceTimer = useRef(null);

    const runFilterRequest = useCallback((params) => {
        router.get(route("quotations.index"), params, {
            preserveState: true,
            replace: true,
        });
    }, []);

    function changeStatus(value) {
        setStatus(value);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        runFilterRequest({ search, status: value });
    }

    // Debounce search-as-you-type so we don't hit the server on every
    // keystroke — only after the user pauses for SEARCH_DEBOUNCE_MS.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(() => {
            runFilterRequest({ search, status });
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const handleSearchChange = useCallback((e) => {
        setSearch(e.target.value);
    }, []);

    // Memoize the row list so it's only recomputed when the underlying
    // quotations data actually changes, not on every parent re-render
    // (e.g. while the user is typing in the search box).
    const rows = useMemo(() => {
        return quotations.data.map((q) => (
            <tr key={q.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">
                    <Link
                        href={route("quotations.show", q.id)}
                        className="hover:text-indigo-600"
                    >
                        {q.qt_no}
                    </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                    {formatCustomerName(q.customer) || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                    {formatDate(q.qt_date, "")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                    {q.items?.length ?? 0}
                </td>
                <td className="px-4 py-3 text-right text-slate-700">
                    {formatCurrency(q.total_amount)}
                </td>
                {/* <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                </td> */}
                <td className="px-4 py-3 text-center text-slate-600 space-x-2">
                    <Link
                        href={route("quotations.show", q.id)}
                        className="rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                        View
                    </Link>

                    <a
                        href={route("quotations.print", q.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Print Slip
                    </a>
                </td>
            </tr>
        ));
    }, [quotations.data]);

    const paginationLinks = useMemo(() => {
        if (!quotations.links || quotations.links.length <= 3) return null;

        return quotations.links.map((link, i) => (
            <button
                key={i}
                disabled={!link.url}
                onClick={() =>
                    link.url &&
                    router.get(
                        link.url,
                        {},
                        { preserveState: true, preserveScroll: true },
                    )
                }
                dangerouslySetInnerHTML={{ __html: link.label }}
                className={`rounded-md px-3 py-1.5 text-sm ${
                    link.active
                        ? "bg-indigo-600 text-white"
                        : link.url
                          ? "text-slate-600 hover:bg-slate-100"
                          : "cursor-not-allowed text-slate-300"
                }`}
            />
        ));
    }, [quotations.links]);

    return (
        <AuthenticatedLayout>
            <Head title="Quotations" />

            <div className="mx-auto max-w-6xl px-4 py-8 relative z-10">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Quotations
                    </h1>
                    <Link href={route("quotations.create")}>
                        <Button size="sm" className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            New Quotation
                        </Button>
                    </Link>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <input
                        type="text"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search Q.F. No. or customer..."
                        className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    {/* <select
                        value={status}
                        onChange={(e) => changeStatus(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="all">All statuses</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="approved">Approved</option>
                        <option value="cancelled">Cancelled</option>
                    </select> */}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Q.F. No.</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Items</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                {/* <th className="px-4 py-3">Status</th> */}
                                <th className="px-4 py-3 text-center">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {quotations.data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-8 text-center text-slate-400"
                                    >
                                        No quotations found.
                                    </td>
                                </tr>
                            ) : (
                                rows
                            )}
                        </tbody>
                    </table>
                </div>

                {paginationLinks && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
                        {paginationLinks}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
