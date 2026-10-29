import { useState } from "react";
import { router } from "@inertiajs/react";

/**
 * useStockTransferList
 * Search + status filter for the transfers list (Index page). Filtering runs
 * on the server, so it covers every page, not just the one on screen.
 */
export function useStockTransferList({
    initialSearch = "",
    initialStatus = "all",
} = {}) {
    const [search, setSearch] = useState(initialSearch);
    const [statusFilter, setStatusFilter] = useState(initialStatus);

    const visit = (params) =>
        router.get(route("stock-transfers.index"), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    const applyFilters = () => {
        visit({
            search: search.trim() || undefined,
            status: statusFilter !== "all" ? statusFilter : undefined,
        });
    };

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("all");
        visit({});
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
