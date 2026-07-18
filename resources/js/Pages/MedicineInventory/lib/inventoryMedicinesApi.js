export async function searchInventoryMedicines(query, context = "stock_in") {
    const params = new URLSearchParams({
        search: query,
        context,
    });

    const response = await fetch(
        `${route("medicine-inventory.medicines.search")}?${params.toString()}`,
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

export async function fetchInventoryMedicine(productId, context = "stock_in") {
    const params = new URLSearchParams();

    if (context === "stock_out") {
        params.set("available_only", "1");
    }

    const query = params.toString();
    const url = query
        ? `${route("medicine-inventory.medicines.show", productId)}?${query}`
        : route("medicine-inventory.medicines.show", productId);

    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch medicine details");
    }

    return response.json();
}
