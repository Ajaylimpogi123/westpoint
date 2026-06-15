export const dispatchCartUpdate = (count) => {
    window.dispatchEvent(new CustomEvent('cart-updated', { 
        detail: { count } 
    }));
};

export const listenToCartUpdates = (callback) => {
    const handleCartUpdate = (event) => {
        if (event.detail && event.detail.count !== undefined) {
            callback(event.detail.count);
        }
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    
    return () => {
        window.removeEventListener('cart-updated', handleCartUpdate);
    };
};