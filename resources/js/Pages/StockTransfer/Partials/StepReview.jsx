import { formatDate, PRIORITY_CONFIG } from "../lib/TransferHelpers";

/**
 * StepReview — Wizard Step 3
 * Summary of all selected items and route before submission.
 *
 * Props: data, selectedItems[], branches[], processing, onSubmit(), onBack()
 */
export default function StepReview({
    data,
    selectedItems,
    branches,
    userBranchName,
    processing,
    onSubmit,
    onBack,
}) {
    const toBranch = branches.find((b) => b.id == data.to_branch_id);
    const priority = PRIORITY_CONFIG[data.priority] ?? PRIORITY_CONFIG.normal;

    return (
        <div className="space-y-5">
            <p className="text-sm text-gray-500">
                Review the details below before submitting. Stock won't move
                until an admin approves this request.
            </p>

            {/* Route + meta summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">
                    Transfer details
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    <Detail label="From" value={userBranchName || "—"} />
                    <Detail label="To" value={toBranch?.branch_name ?? "—"} />
                    <Detail
                        label="Transfer date"
                        value={formatDate(data.transfer_date)}
                    />
                    <Detail
                        label="Needed by"
                        value={
                            data.needed_by
                                ? formatDate(data.needed_by)
                                : "Not set"
                        }
                    />
                    <div>
                        <div className="text-xs text-gray-400 uppercase mb-1">
                            Priority
                        </div>
                        <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.bg} ${priority.color}`}
                        >
                            {priority.label}
                        </span>
                    </div>
                    {data.reason && (
                        <div className="col-span-2">
                            <div className="text-xs text-gray-400 uppercase mb-1">
                                Reason
                            </div>
                            <div className="text-gray-700">{data.reason}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Items list */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs uppercase tracking-wide text-gray-400 font-medium">
                    Items ({selectedItems.length})
                </div>
                <div className="divide-y divide-gray-100">
                    {selectedItems.map((item, idx) => (
                        <div
                            key={item._key ?? idx}
                            className="px-4 py-3 flex items-center justify-between"
                        >
                            <div>
                                <div className="text-sm font-medium text-gray-800">
                                    {item._product_name}
                                    <span className="text-gray-400 font-normal ml-1">
                                        · {item._brand}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                    <span className="font-mono">
                                        Lot {item.lot_number}
                                    </span>
                                    {item.expiry && (
                                        <span>
                                            {" "}
                                            · Expires {formatDate(item.expiry)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-sm font-semibold text-gray-800 ml-4">
                                {item.quantity_requested} units
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition"
                >
                    ← Back
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={processing}
                    className="text-sm px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                >
                    {processing ? "Submitting…" : "Submit request"}
                </button>
            </div>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div>
            <div className="text-xs text-gray-400 uppercase mb-1">{label}</div>
            <div className="text-gray-800 font-medium">{value}</div>
        </div>
    );
}
