import { useState } from "react";
import { useForm } from "@inertiajs/react";

/**
 * useApproval
 * Drives the admin Approve / Reject flow and the requester's Cancel.
 * Server-side failures come back as errors.status and are shown as a toast
 * by the Index page.
 */
export function useApproval() {
    const [rejectingId, setRejectingId] = useState(null); // which transfer is being rejected
    const [approvingId, setApprovingId] = useState(null); // which card shows "Processing…"

    const approveForm = useForm({});
    const rejectForm = useForm({ rejection_note: "" });

    // ── Approve ───────────────────────────────────────────

    const approve = (transfer) => {
        // Approving moves stock immediately, so ask first.
        if (
            !confirm(
                `Approve ${transfer.transfer_no}? Stock moves from ${transfer.from_branch?.branch_name} to ${transfer.to_branch?.branch_name} right away.`,
            )
        ) {
            return;
        }

        setApprovingId(transfer.id);
        approveForm.post(route("stock-transfers.approve", transfer.id), {
            preserveScroll: true,
            onFinish: () => setApprovingId(null),
        });
    };

    // ── Reject ────────────────────────────────────────────

    const openReject = (transferId) => {
        setRejectingId(transferId);
        rejectForm.clearErrors();
        rejectForm.reset();
    };

    const closeReject = () => {
        setRejectingId(null);
        rejectForm.reset();
    };

    const submitReject = (transferId) => {
        rejectForm.post(route("stock-transfers.reject", transferId), {
            preserveScroll: true,
            onSuccess: () => closeReject(),
        });
    };

    // ── Cancel (requester) ────────────────────────────────

    const cancelForm = useForm({});

    const cancel = (transferId) => {
        if (!confirm("Cancel this transfer request?")) return;
        cancelForm.post(route("stock-transfers.cancel", transferId), {
            preserveScroll: true,
        });
    };

    return {
        // approve
        approve,
        approvingId,
        approveProcessing: approveForm.processing,

        // reject
        rejectingId,
        openReject,
        closeReject,
        submitReject,
        rejectNote: rejectForm.data.rejection_note,
        setRejectNote: (v) => rejectForm.setData("rejection_note", v),
        rejectProcessing: rejectForm.processing,
        rejectErrors: rejectForm.errors,

        // cancel
        cancel,
        cancelProcessing: cancelForm.processing,
    };
}
