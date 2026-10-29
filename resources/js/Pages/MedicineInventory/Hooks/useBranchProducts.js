import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBranchProducts } from "../lib/inventoryMedicinesApi";

/**
 * Loads the medicines (and their lots) for exactly one branch while a
 * transaction modal is open.
 *
 * - Clears the list immediately whenever the branch changes, so medicines
 *   from the previous branch are never selectable while the new list loads.
 * - Ignores responses for a branch that is no longer selected (fast
 *   switching between branches can resolve requests out of order).
 */
export default function useBranchProducts({ open, branchId }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);
    const requestRef = useRef(0);

    const targetBranchId = Number(branchId) || null;

    useEffect(() => {
        const requestId = ++requestRef.current;

        setProducts([]);
        setError(null);

        if (!open || !targetBranchId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        fetchBranchProducts(targetBranchId)
            .then((response) => {
                if (requestRef.current === requestId) {
                    setProducts(response?.products ?? []);
                }
            })
            .catch(() => {
                if (requestRef.current === requestId) {
                    setProducts([]);
                    setError(
                        "Could not load medicines for the selected branch.",
                    );
                }
            })
            .finally(() => {
                if (requestRef.current === requestId) {
                    setLoading(false);
                }
            });
    }, [open, targetBranchId, reloadToken]);

    const reload = useCallback(() => setReloadToken((token) => token + 1), []);

    return { products, loading, error, reload };
}

/**
 * Branch to preselect when a transaction modal opens: the session branch,
 * else (admins/superadmins only) the first real branch in the list. Staff
 * never fall back to another branch.
 */
export function resolveDefaultBranchId(
    branchId,
    branches = [],
    canAssignBranch = false,
) {
    if (branchId) {
        return branchId;
    }

    return canAssignBranch ? (branches[0]?.id ?? null) : null;
}
