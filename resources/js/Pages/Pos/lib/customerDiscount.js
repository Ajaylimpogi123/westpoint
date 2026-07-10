export function isDiscountEligible(customer) {
    if (!customer?.customer_type) {
        return false;
    }

    return (
        customer.customer_type === "Senior Citizen" ||
        customer.customer_type === "PWD"
    );
}

export function percentDiscountAmount(grossTotal, percent) {
    const gross = Number(grossTotal) || 0;
    const amount = Math.round(gross * (percent / 100) * 100) / 100;

    return Math.min(amount, gross);
}

export function formatCustomerName(customer) {
    if (!customer) {
        return "";
    }

    return `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
}
