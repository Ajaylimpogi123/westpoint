export async function fetchPosProducts(search, page = 1) {
    const params = new URLSearchParams();

    if (search) {
        params.set("search", search);
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
