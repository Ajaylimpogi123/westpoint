export async function fetchPosProducts(search, page = 1, filters = {}) {
    const params = new URLSearchParams();

    if (search) {
        params.set("search", search);
    }

    if (filters.form) {
        params.set("form", filters.form);
    }

    if (filters.bestSeller) {
        params.set("best_seller", "1");
    }

    if (filters.inStock) {
        params.set("in_stock", "1");
    }

    if (filters.genericOnly) {
        params.set("generic_only", "1");
    }

    params.set("page", String(page));

    const response = await fetch(
        `${route("pos.products.search")}?${params.toString()}`,
        {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to fetch products");
    }

    return response.json();
}
