import { useState } from "react";

/**
 * Guards changing the branch of a transaction form. Items in the basket
 * belong to the branch they were picked from, so switching branch must
 * clear them; when the basket is not empty the user confirms first.
 *
 * `applyChange(branchId)` must reset the branch, the basket and the draft
 * in one step.
 */
export default function useBranchSwitch({ currentBranchId, itemCount, applyChange }) {
    const [pendingBranchId, setPendingBranchId] = useState(null);

    const requestBranchChange = (value) => {
        if (String(value ?? "") === String(currentBranchId ?? "")) {
            return;
        }

        if (itemCount > 0) {
            setPendingBranchId(String(value));
            return;
        }

        applyChange(String(value));
    };

    const confirmBranchChange = () => {
        if (pendingBranchId !== null) {
            applyChange(pendingBranchId);
        }

        setPendingBranchId(null);
    };

    const cancelBranchChange = () => setPendingBranchId(null);

    return {
        pendingBranchId,
        requestBranchChange,
        confirmBranchChange,
        cancelBranchChange,
        resetBranchSwitch: cancelBranchChange,
    };
}
