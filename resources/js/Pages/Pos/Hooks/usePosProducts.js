import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPosProducts } from "../lib/posProductsApi";

const SEARCH_COOLDOWN_MS = 1500;

const DEFAULT_FILTERS = {
    form: "",
    bestSeller: false,
    inStock: true,
    genericOnly: false,
};

export function usePosProducts() {
    const [searchInput, setSearchInput] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchThrottled, setSearchThrottled] = useState(false);
    const cooldownTimerRef = useRef(null);

    const updateFilter = useCallback((key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const runSearch = useCallback(async (page, searchTerm, currentFilters) => {
        setLoading(true);
        setProducts([]);
        setHasSearched(true);

        try {
            const data = await fetchPosProducts(searchTerm, page, currentFilters);

            setProducts(data.data ?? []);
            setPagination({
                currentPage: data.current_page,
                lastPage: data.last_page,
                from: data.from,
                to: data.to,
                total: data.total,
            });
            setActiveSearch(searchTerm);
            setActiveFilters(currentFilters);
        } catch {
            setProducts([]);
            setPagination(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        runSearch(1, "", DEFAULT_FILTERS);
    }, [runSearch]);

    const executeSearch = useCallback(() => {
        if (searchThrottled || loading) {
            return;
        }

        setSearchThrottled(true);

        if (cooldownTimerRef.current) {
            clearTimeout(cooldownTimerRef.current);
        }

        cooldownTimerRef.current = setTimeout(() => {
            setSearchThrottled(false);
            cooldownTimerRef.current = null;
        }, SEARCH_COOLDOWN_MS);

        runSearch(1, searchInput.trim(), filters);
    }, [searchThrottled, loading, searchInput, filters, runSearch]);

    const goToPage = useCallback(
        (page) => {
            if (loading || !pagination) {
                return;
            }

            runSearch(page, activeSearch, activeFilters);
        },
        [loading, pagination, activeSearch, activeFilters, runSearch],
    );

    return {
        searchInput,
        setSearchInput,
        filters,
        updateFilter,
        products,
        pagination,
        loading,
        hasSearched,
        searchDisabled: searchThrottled || loading,
        executeSearch,
        goToPage,
    };
}
