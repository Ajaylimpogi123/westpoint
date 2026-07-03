import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPosProducts } from "../lib/posProductsApi";

const SEARCH_COOLDOWN_MS = 1500;

export function usePosProducts() {
    const [searchInput, setSearchInput] = useState("");
    const [activeSearch, setActiveSearch] = useState("");
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchThrottled, setSearchThrottled] = useState(false);
    const cooldownTimerRef = useRef(null);

    const runSearch = useCallback(async (page, searchTerm) => {
        setLoading(true);
        setProducts([]);
        setHasSearched(true);

        try {
            const data = await fetchPosProducts(searchTerm, page);

            setProducts(data.data ?? []);
            setPagination({
                currentPage: data.current_page,
                lastPage: data.last_page,
                from: data.from,
                to: data.to,
                total: data.total,
            });
            setActiveSearch(searchTerm);
        } catch {
            setProducts([]);
            setPagination(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        runSearch(1, "");
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

        runSearch(1, searchInput.trim());
    }, [searchThrottled, loading, searchInput, runSearch]);

    const goToPage = useCallback(
        (page) => {
            if (loading || !pagination) {
                return;
            }

            runSearch(page, activeSearch);
        },
        [loading, pagination, activeSearch, runSearch],
    );

    return {
        searchInput,
        setSearchInput,
        products,
        pagination,
        loading,
        hasSearched,
        searchDisabled: searchThrottled || loading,
        executeSearch,
        goToPage,
    };
}
