export function formatCustomerName(customer) {
    if (!customer) {
        return "";
    }

    return `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
}
