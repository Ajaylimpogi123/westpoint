/**
 * RejectForm
 * Inline rejection reason form shown inside ApprovalCard.
 * Props: note, setNote, onSubmit, onCancel, processing, errors
 */
export default function RejectForm({
    note,
    setNote,
    onSubmit,
    onCancel,
    processing,
    errors,
}) {
    return (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide">
                Reason for rejection
            </p>

            <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell the requester why this transfer is rejected…"
                className={`w-full text-sm border rounded-lg px-3 py-2 resize-none
                    focus:ring-2 focus:ring-red-400 focus:outline-none bg-white
                    ${errors?.rejection_note ? "border-red-400" : "border-red-200"}`}
            />
            {errors?.rejection_note && (
                <p className="text-xs text-red-600">{errors.rejection_note}</p>
            )}

            <div className="flex items-center gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={processing}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={processing || !note.trim()}
                    className="text-xs px-4 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700
                        disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    {processing ? "Submitting…" : "Confirm reject"}
                </button>
            </div>
        </div>
    );
}
