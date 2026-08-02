import RejectForm from "./RejectForm";
import TransferStatusBadge from "./TransferStatusBadge";
import { formatDate, PRIORITY_CONFIG } from "../lib/TransferHelpers";

/**
 * ApprovalCard
 * Shown in admin's "Pending" tab. Each card has inline Approve / Reject actions.
 *
 * Props: transfer, approval (from useApproval hook), onView(transfer)
 */
export default function ApprovalCard({ transfer, approval, onView }) {
    const priority =
        PRIORITY_CONFIG[transfer.priority] ?? PRIORITY_CONFIG.normal;
    const isRejecting = approval.rejectingId === transfer.id;
    const isApproving = approval.approveProcessing;

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Priority accent bar */}
            <div
                className={`h-1 ${
                    transfer.priority === "urgent"
                        ? "bg-red-400"
                        : transfer.priority === "routine"
                          ? "bg-gray-300"
                          : "bg-blue-400"
                }`}
            />

            <div className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                    <div>
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

                        <div className="text-sm font-semibold text-gray-800">
                            {transfer.from_branch?.branch_name}
                            <span className="text-gray-400 mx-1">→</span>
                            {transfer.to_branch?.branch_name}
                        </div>

                        <div className="text-xs text-gray-400 mt-0.5">
                            Requested by{" "}
                            <span className="font-medium text-gray-600">
                                {transfer.requester?.name}
                            </span>{" "}
                            · {formatDate(transfer.transfer_date)}
                            {transfer.needed_by && (
                                <span className="ml-1 text-yellow-600">
                                    · Needed by {formatDate(transfer.needed_by)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* View detail */}
                    <button
                        type="button"
                        onClick={() => onView(transfer)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200
                            text-gray-500 hover:bg-gray-50 flex-shrink-0 transition"
                    >
                        View details
                    </button>
                </div>

                {/* Items list */}
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-100 border border-gray-100">
                    {transfer.items?.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between px-3 py-2.5"
                        >
                            <div>
                                <div className="text-sm font-medium text-gray-800">
                                    {item.product?.med_name}{" "}
                                    {item.product?.dose}
                                    <span className="text-gray-400 font-normal ml-1 text-xs">
                                        {item.product?.brand_name}
                                    </span>
                                </div>
                                <div className="text-xs font-mono text-gray-400 mt-0.5">
                                    Lot {item.lot_number}
                                    {item.expiry &&
                                        ` · exp. ${formatDate(item.expiry)}`}
                                </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-700 ml-4">
                                {item.quantity_requested} units
                            </span>
                        </div>
                    ))}
                </div>

                {/* Reason */}
                {transfer.reason && (
                    <p className="text-xs text-gray-500 italic">
                        "{transfer.reason}"
                    </p>
                )}

                {/* Reject form (inline, toggled) */}
                {isRejecting && (
                    <RejectForm
                        note={approval.rejectNote}
                        setNote={approval.setRejectNote}
                        onSubmit={() => approval.submitReject(transfer.id)}
                        onCancel={approval.closeReject}
                        processing={approval.rejectProcessing}
                        errors={approval.rejectErrors}
                    />
                )}

                {/* Action buttons */}
                {!isRejecting && (
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => approval.approve(transfer.id)}
                            disabled={isApproving}
                            className="flex-1 text-sm py-2 rounded-lg bg-green-600 text-white
                                hover:bg-green-700 disabled:opacity-40 transition font-medium"
                        >
                            {isApproving
                                ? "Processing…"
                                : "✓ Approve & move stock"}
                        </button>
                        <button
                            type="button"
                            onClick={() => approval.openReject(transfer.id)}
                            className="flex-1 text-sm py-2 rounded-lg border border-red-300
                                text-red-600 hover:bg-red-50 transition font-medium"
                        >
                            ✕ Reject
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
