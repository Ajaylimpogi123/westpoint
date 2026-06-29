import { Link } from "@inertiajs/react";
import TransferRow from "./TransferRow";

/**
 * TransfersTable
 * Renders the list of transfer rows + pagination links.
 * Props: transfers (Inertia paginator), isAdmin, onCancel
 */
export default function TransfersTable({
    transfers,
    isAdmin,
    onCancel,
    onView,
}) {
    const { data, links, meta } = transfers;

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <svg
                    className="w-12 h-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                </svg>
                <p className="text-sm">No transfer requests found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Rows */}
            {data.map((transfer) => (
                <TransferRow
                    key={transfer.id}
                    transfer={transfer}
                    isAdmin={isAdmin}
                    onCancel={onCancel}
                    onView={onView}
                />
            ))}

            {/* Pagination */}
            {links && links.length > 3 && (
                <div className="flex items-center justify-center gap-1 pt-4">
                    {links.map((link, i) => (
                        <Link
                            key={i}
                            href={link.url ?? "#"}
                            preserveScroll
                            className={`px-3 py-1.5 text-xs rounded-lg border transition
                                ${
                                    !link.url
                                        ? "text-gray-300 border-gray-100 cursor-not-allowed"
                                        : link.active
                                          ? "bg-blue-600 text-white border-blue-600"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            )}

            {/* Count */}
            {meta && (
                <p className="text-center text-xs text-gray-400">
                    Showing {meta.from}–{meta.to} of {meta.total} requests
                </p>
            )}
        </div>
    );
}
