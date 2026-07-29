import { useState } from "react";
import { useForm } from "@inertiajs/react";

/**
 * useApproval
 * Drives the admin Approve / Reject flow.
 * Used by ApprovalCard and the pending tab on Index.
 */
export function useApproval() {
    const [rejectingId, setRejectingId] = useState(null); // which transfer is being rejected

    const approveForm = useForm({});
    const rejectForm = useForm({ rejection_note: "" });

    // ── Approve ───────────────────────────────────────────

    const approve = (transferId) => {
        approveForm.post(route("stock-transfers.approve", transferId), {
            onSuccess: () => approveForm.reset(),
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
            onSuccess: () => closeReject(),
        });
    };

    // ── Cancel (staff) ────────────────────────────────────

    const cancelForm = useForm({});

    const cancel = (transferId) => {
        if (!confirm("Cancel this transfer request?")) return;
        cancelForm.post(route("stock-transfers.cancel", transferId));
    };

    return {
        // approve
        approve,
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
