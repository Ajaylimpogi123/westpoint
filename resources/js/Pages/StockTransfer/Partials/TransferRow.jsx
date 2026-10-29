import { Link } from "@inertiajs/react";
import TransferStatusBadge from "./TransferStatusBadge";
import PipelineBar from "./PipelineBar";
import { formatDate, PRIORITY_CONFIG } from "../lib/TransferHelpers";

/**
 * TransferRow
 * One card-style row for the list view.
 * Props: transfer, isAdmin, onCancel, onView
 */
export default function TransferRow({
    transfer,
    isAdmin,
    currentUserId,
    onCancel,
    onView,
}) {
    const priority =
        PRIORITY_CONFIG[transfer.priority] ?? PRIORITY_CONFIG.normal;
    const itemCount = transfer.items?.length ?? 0;
    const firstItem = transfer.items?.[0];
    // Only the person who raised the request can cancel it (server rule).
    const canCancel =
        transfer.status === "pending" &&
        Number(transfer.requested_by) === Number(currentUserId);

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition">
            {/* Top row */}
            <div className="flex flex-col gap-3 mb-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    {/* Ref + status */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">
                            {transfer.transfer_no}
                        </span>
                        <TransferStatusBadge status={transfer.status} />
                        {transfer.priority !== "normal" && (
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.bg} ${priority.color}`}
                            >
                                {priority.label}
                            </span>
                        )}
                    </div>

                    {/* Main description */}
                    <div className="text-sm font-semibold text-gray-800">
                        {itemCount === 1 && firstItem
                            ? [firstItem.product?.med_name, firstItem.product?.dose]
                                  .filter(Boolean)
                                  .join(" ")
                            : `${itemCount} items`}
                        <span className="text-gray-400 font-normal ml-1 text-xs">
                            · {transfer.from_branch?.branch_name} →{" "}
                            {transfer.to_branch?.branch_name}
                        </span>
                    </div>

                    {/* Meta */}
                    <div className="text-xs text-gray-400 mt-0.5">
                        {isAdmin && transfer.requester && (
                            <span>By {transfer.requester.name} · </span>
                        )}
                        {formatDate(transfer.transfer_date)}
                        {itemCount === 1 && firstItem && (
                            <span className="ml-1 font-mono">
                                · Lot {firstItem.lot_number ?? "—"}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Actions ──────────────────────────────── */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View detail modal */}
                    <button
                        type="button"
                        onClick={() => onView?.(transfer)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200
                            text-gray-600 hover:bg-gray-50 transition"
                    >
                        View
                    </button>

                    {/* Cancel — requester only, pending only */}
                    {canCancel && (
                        <button
                            type="button"
                            onClick={() => onCancel(transfer.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-red-200
                                text-red-600 hover:bg-red-50 transition"
                        >
                            Cancel
                        </button>
                    )}

                    {/* View & print slip — approved only */}
                    {transfer.status === "approved" && (
                        <Link
                            href={route("stock-transfers.slip", transfer.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200
                                text-blue-600 hover:bg-blue-50 transition flex items-center gap-1"
                            onClick={(e) => {
                                e.preventDefault();
                                window.open(
                                    route("stock-transfers.slip", transfer.id),
                                    "_blank",
                                    "noopener,noreferrer",
                                );
                            }}
                        >
                            <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2
                                    2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2
                                    2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0
                                    00-2 2v4h10z"
                                />
                            </svg>
                            Print slip
                        </Link>
                    )}
                </div>
            </div>

            {/* Pipeline bar */}
            <PipelineBar status={transfer.status} />
        </div>
    );
}
