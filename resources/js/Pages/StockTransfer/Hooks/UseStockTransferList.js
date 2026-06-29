import { useState } from "react";
import { router } from "@inertiajs/react";

/**
 * useStockTransferList
 * Search + status filter for the transfers list (Index page).
 */
export function useStockTransferList({
    initialSearch = "",
    initialStatus = "all",
} = {}) {
    const [search, setSearch] = useState(initialSearch);
    const [statusFilter, setStatusFilter] = useState(initialStatus);

    const applyFilters = () => {
        router.get(
            route("stock-transfers.index"),
            {
                search: search || undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("all");
        router.get(
            route("stock-transfers.index"),
            {},
            { preserveState: false },
        );
    };

    const handleSearchKey = (e) => {
        if (e.key === "Enter") applyFilters();
    };

    return {
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        applyFilters,
        clearFilters,
        handleSearchKey,
    };
}
