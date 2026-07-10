import axios from "axios";

export async function searchCustomers(query) {
    const { data } = await axios.get(route("pos.customers.search"), {
        params: { search: query },
    });

    return data;
}

export async function createCustomer(payload) {
    const { data } = await axios.post(route("pos.customers.store"), payload);

    return data;
}
