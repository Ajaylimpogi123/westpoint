import { useEffect, useMemo, useState } from "react";
import { filterProducts } from "../lib/filterProducts";

export function usePosProducts(initialProducts) {
    const [allProducts, setAllProducts] = useState(initialProducts ?? []);
    const [search, setSearch] = useState("");

    useEffect(() => {
        setAllProducts(initialProducts ?? []);
    }, [initialProducts]);

    const filteredProducts = useMemo(
        () => filterProducts(allProducts, search),
        [allProducts, search],
    );

    return {
        allProducts,
        search,
        setSearch,
        filteredProducts,
    };
}
