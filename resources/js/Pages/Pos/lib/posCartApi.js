import axios from "axios";

export async function addCartItem(productId, unitType) {
    const { data } = await axios.post(route("pos.cart.items.store"), {
        product_id: productId,
        unit_type: unitType,
    });

    return data;
}

export async function updateCartCustomer(customerId) {
    const { data } = await axios.patch(route("pos.cart.update"), {
        customer_id: customerId,
    });

    return data;
}

export async function updateCartItem(cartItemId, payload) {
    const { data } = await axios.patch(
        route("pos.cart.items.update", cartItemId),
        payload,
    );

    return data;
}

export async function removeCartItem(cartItemId) {
    const { data } = await axios.delete(
        route("pos.cart.items.destroy", cartItemId),
    );

    return data;
}

export async function fetchCheckoutPreview() {
    const { data } = await axios.get(route("pos.cart.checkout-preview"));

    return data;
}
