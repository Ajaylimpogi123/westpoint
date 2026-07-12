export async function searchQuotationMedicines(query) {
    const params = new URLSearchParams({ search: query });

    const response = await fetch(
        `${route("quotations.medicines.search")}?${params.toString()}`,
        {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to search medicines");
    }

    return response.json();
}

export async function fetchQuotationMedicine(productId) {
    const response = await fetch(
        route("quotations.medicines.show", productId),
        {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to fetch medicine details");
    }

    return response.json();
}
