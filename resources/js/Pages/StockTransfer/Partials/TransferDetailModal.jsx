import { Link } from "@inertiajs/react";
import TransferStatusBadge from "./TransferStatusBadge";
import PipelineBar from "./PipelineBar";
import TransferLogsPanel from "./TransferLogsPanel";
import {
    formatDate,
    formatDateTime,
    PRIORITY_CONFIG,
} from "../lib/transferHelpers";

/**
 * TransferDetailModal
 * Full-screen overlay showing all transfer info + logs.
 * Props: transfer (with eager-loaded relations), onClose()
 */
export default function TransferDetailModal({ transfer, onClose }) {
    const priority =
        PRIORITY_CONFIG[transfer.priority] ?? PRIORITY_CONFIG.normal;
    const isApproved = transfer.status === "approved";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh]
                flex flex-col overflow-hidden"
            >
                {/* ── Header ──────────────────────────────── */}
                <div
                    className="flex items-start justify-between px-6 pt-5 pb-4
                    border-b border-gray-100"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-gray-400">
                                {transfer.transfer_no}
                            </span>
                            <TransferStatusBadge status={transfer.status} />
                            {transfer.priority !== "normal" && (
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-full
                                    font-medium ${priority.bg} ${priority.color}`}
                                >
                                    {priority.label}
                                </span>
                            )}
                        </div>
                        <h2 className="text-base font-semibold text-gray-900">
                            {transfer.from_branch?.branch_name}
                            <span className="text-gray-400 mx-1 font-normal">
                                →
                            </span>
                            {transfer.to_branch?.branch_name}
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1
                            rounded-lg hover:bg-gray-100 transition"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Scrollable body ──────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {/* Pipeline */}
                    <PipelineBar status={transfer.status} />

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <Detail
                            label="Requested by"
                            value={transfer.requester?.name ?? "—"}
                        />
                        <Detail
                            label="Transfer date"
                            value={formatDate(transfer.transfer_date)}
                        />
                        <Detail
                            label="Needed by"
                            value={
                                transfer.needed_by
                                    ? formatDate(transfer.needed_by)
                                    : "Not set"
                            }
                        />
                        {transfer.approved_at && (
                            <Detail
                                label="Approved at"
                                value={formatDateTime(transfer.approved_at)}
                            />
                        )}
                        {transfer.approver && (
                            <Detail
                                label="Actioned by"
                                value={transfer.approver.name}
                            />
                        )}
                        {transfer.rejection_note && (
                            <div
                                className="col-span-2 bg-red-50 border border-red-100
                                rounded-lg px-3 py-2"
                            >
                                <div className="text-xs uppercase text-red-500 mb-0.5">
                                    Rejection reason
                                </div>
                                <div className="text-sm text-red-700">
                                    {transfer.rejection_note}
                                </div>
                            </div>
                        )}
                        {transfer.reason && (
                            <div className="col-span-2">
                                <Detail
                                    label="Reason"
                                    value={transfer.reason}
                                />
                            </div>
                        )}
                    </div>

                    {/* Items */}
                    <div>
                        <div
                            className="text-xs uppercase tracking-wide text-gray-400
                            font-medium mb-2"
                        >
                            Items ({transfer.items?.length ?? 0})
                        </div>
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="divide-y divide-gray-100">
                                {transfer.items?.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between px-4 py-3"
                                    >
                                        <div>
                                            <div className="text-sm font-medium text-gray-800">
                                                {item.product?.med_name}{" "}
                                                {item.product?.dose}
                                                <span
                                                    className="text-gray-400 font-normal
                                                    ml-1 text-xs"
                                                >
                                                    · {item.product?.brand_name}
                                                </span>
                                            </div>
                                            <div
                                                className="text-xs text-gray-400
                                                font-mono mt-0.5"
                                            >
                                                Lot {item.lot_number}
                                                {item.expiry &&
                                                    ` · exp. ${formatDate(item.expiry)}`}
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className="text-sm font-semibold text-gray-800">
                                                {item.quantity_approved ??
                                                    item.quantity_requested}{" "}
                                                units
                                            </div>
                                            {item.quantity_approved !== null &&
                                                item.quantity_approved !==
                                                    item.quantity_requested && (
                                                    <div className="text-xs text-yellow-600">
                                                        Requested:{" "}
                                                        {
                                                            item.quantity_requested
                                                        }
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Activity log */}
                    {transfer.logs?.length > 0 && (
                        <div>
                            <div
                                className="text-xs uppercase tracking-wide text-gray-400
                                font-medium mb-3"
                            >
                                Activity
                            </div>
                            <TransferLogsPanel logs={transfer.logs} />
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────── */}
                <div
                    className="px-6 py-4 border-t border-gray-100
                    flex justify-between items-center gap-3"
                >
                    {/* Print slip — only for approved */}
                    {isApproved ? (
                        <Link
                            href={route("stock-transfers.slip", transfer.id)}
                            className="flex items-center gap-2 text-sm px-4 py-2
                                rounded-lg border border-blue-200 text-blue-600
                                hover:bg-blue-50 transition"
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
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0
                                    00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0
                                    00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0
                                    00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                            </svg>
                            View &amp; print slip
                        </Link>
                    ) : (
                        <span className="text-xs text-gray-400 italic">
                            Slip available once approved
                        </span>
                    )}

                    <button
                        onClick={onClose}
                        className="ml-auto text-sm px-4 py-2 rounded-lg bg-gray-100
                            text-gray-700 hover:bg-gray-200 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                {label}
            </div>
            <div className="text-sm text-gray-800 font-medium">{value}</div>
        </div>
    );
}
