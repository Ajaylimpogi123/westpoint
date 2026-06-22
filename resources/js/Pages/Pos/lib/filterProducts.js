export function filterProducts(products, searchTerm) {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
        return products;
    }

    return products.filter((product) => {
        const fields = [
            product.med_name,
            product.brand_name,
            product.dose,
            product.form,
        ];

        return fields.some(
            (field) => field && String(field).toLowerCase().includes(term),
        );
    });
}
