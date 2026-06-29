/**
 * StepRouteReason — Wizard Step 2
 * Secretary picks destination branch, priority, reason, and optional needed-by date.
 *
 * Props: data, setData, errors, branches[], userBranchName, onNext(), onBack()
 */
export default function StepRouteReason({
    data,
    setData,
    errors,
    branches,
    userBranchName,
    onNext,
    onBack,
}) {
    const canProceed = !!data.to_branch_id;

    return (
        <div className="space-y-5">
            {/* Route: from → to */}
            <div className="grid grid-cols-[1fr_32px_1fr] items-end gap-2">
                <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Transfer from
                    </label>
                    <div className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500">
                        {userBranchName || "Your branch"}
                    </div>
                </div>
                <div className="text-center pb-2 text-gray-400 text-lg">→</div>
                <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Transfer to
                    </label>
                    <select
                        value={data.to_branch_id}
                        onChange={(e) =>
                            setData("to_branch_id", e.target.value)
                        }
                        className={`w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none
                            ${errors.to_branch_id ? "border-red-400" : "border-gray-300"}`}
                    >
                        <option value="">— Select destination —</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name}
                            </option>
                        ))}
                    </select>
                    {errors.to_branch_id && (
                        <p className="text-xs text-red-500 mt-1">
                            {errors.to_branch_id}
                        </p>
                    )}
                </div>
            </div>

            {/* Priority + Needed by */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Priority
                    </label>
                    <select
                        value={data.priority}
                        onChange={(e) => setData("priority", e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                        <option value="routine">Routine</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                        Needed by{" "}
                        <span className="normal-case text-gray-400">
                            (optional)
                        </span>
                    </label>
                    <input
                        type="date"
                        value={data.needed_by}
                        onChange={(e) => setData("needed_by", e.target.value)}
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Reason */}
            <div>
                <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Reason for transfer{" "}
                    <span className="normal-case text-gray-400">
                        (optional)
                    </span>
                </label>
                <textarea
                    rows={3}
                    value={data.reason}
                    onChange={(e) => setData("reason", e.target.value)}
                    placeholder="Describe why this transfer is needed…"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
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
                    onClick={onNext}
                    disabled={!canProceed}
                    className="text-sm px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                    Review →
                </button>
            </div>
        </div>
    );
}
