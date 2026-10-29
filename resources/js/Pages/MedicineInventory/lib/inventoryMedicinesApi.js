export async function fetchBranchProducts(branchId) {
    const params = new URLSearchParams({
        branch_id: String(branchId),
    });

    const response = await fetch(
        `${route("medicine-inventory.products")}?${params.toString()}`,
        {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to fetch branch medicines");
    }

    return response.json();
}

export async function fetchMedicineCatalog(query, { signal } = {}) {
    const params = new URLSearchParams({ search: query });

    const response = await fetch(
        `${route("medicine-inventory.catalog")}?${params.toString()}`,
        {
            signal,
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to search existing medicines");
    }

    return response.json();
}

export async function fetchMedicineBranchPresence(productId) {
    const response = await fetch(
        route("medicine-inventory.branch-presence", productId),
        {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to load branches for this medicine");
    }

    return response.json();
}

export async function fetchSimilarMedicines(medName) {
    const params = new URLSearchParams({ med_name: medName });

    const response = await fetch(
        `${route("medicine-inventory.similar")}?${params.toString()}`,
        {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to load similar medicines");
    }

    return response.json();
}
