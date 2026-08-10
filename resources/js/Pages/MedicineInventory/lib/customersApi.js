import axios from "axios";

export async function fetchBranchCustomers(branchId) {
    const response = await axios.get(route("customer-management.for-branch"), {
        params: { branch_id: branchId },
    });
    return response.data;
}

export async function createCustomer(payload) {
    const response = await axios.post(
        route("customer-management.quick-store"),
        payload,
    );
    return response.data;
}
