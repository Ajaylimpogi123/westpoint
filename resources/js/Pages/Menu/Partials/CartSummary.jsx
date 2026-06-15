import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Plus, Minus, X, Printer } from "lucide-react";
import { useState, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { Banknote, Smartphone } from "lucide-react";
import LoadingOverlay from "../../Order/Component/LoadingOverlay";

export default function CartSummary({ products = [], tableNumber, table_id }) {
    const { props } = usePage();
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [cartItems, setCartItems] = useState(products);
    const [loadingItem, setLoadingItem] = useState(null);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastOrder, setLastOrder] = useState(null);
    const [discount, setDiscount] = useState(0);
    const [payment, setPayment] = useState(0);
    const [hasAutoPrinted, setHasAutoPrinted] = useState(false);

    // Update local state when props change
    useEffect(() => {
        setCartItems(products);
    }, [products]);

    // Check for order data in props
    useEffect(() => {
        // console.log("🔥 Checking for order data...");
        // console.log("Props:", props);
        // console.log("Flash:", props.flash);
        
        // Check if order exists in flash
        if (props.flash?.order) {
            console.log("✅ Order found in flash:", props.flash.order);
            setLastOrder(props.flash.order);
            setShowSuccessModal(true);
            
            // Auto-print after a short delay
            if (!hasAutoPrinted && props.flash.order.od_id) {
                setTimeout(() => {
                    console.log("🖨️ Auto-printing receipt for order:", props.flash.order.od_id);
                    window.open(route('order.print', props.flash.order.od_id), '_blank');
                    setHasAutoPrinted(true);
                }, 500);
            }
        }
    }, [props.flash]);

    const removeItem = (productId) => {
        if (!table_id) {
            toast.error("No table selected");
            return;
        }

        const cartItem = cartItems.find(
            (item) => (item.pd_id || item.id) === productId,
        );

        if (!cartItem || !cartItem.ct_id) {
            toast.error("Cart item not found");
            return;
        }

        setLoadingItem(productId);

        router.delete(
            route("cart.destroy", {
                table_id: table_id,
                cart: cartItem.ct_id,
            }),
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    toast.success("Item removed from cart");
                },
                onError: (errors) => {
                    toast.error("Failed to remove item");
                },
                onFinish: () => {
                    setLoadingItem(null);
                },
            },
        );
    };

    const updateQuantity = (productId, change) => {
        if (!table_id) {
            toast.error("No table selected");
            return;
        }

        const cartItem = cartItems.find(
            (item) => (item.pd_id || item.id) === productId,
        );

        if (!cartItem || !cartItem.ct_id) {
            toast.error("Cart item not found");
            return;
        }

        const newQuantity = Math.max(1, (cartItem.ct_qty || 1) + change);

        setLoadingItem(productId);

        router.patch(
            route("cart.update", {
                table_id: table_id,
                cart: cartItem.ct_id,
            }),
            {
                ct_qty: newQuantity,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    toast.success("Quantity updated");
                },
                onError: (errors) => {
                    toast.error("Failed to update quantity");
                },
                onFinish: () => {
                    setLoadingItem(null);
                },
            },
        );
    };

    const subTotal = cartItems.reduce(
        (sum, product) =>
            sum + Number(product.pd_price || product.ct_price) * product.ct_qty,
        0,
    );

    const amountDue = Math.max(subTotal - discount, 0);
    const change = Math.max(payment - amountDue, 0);

    const itemCount = cartItems.reduce(
        (sum, product) => sum + product.ct_qty,
        0,
    );

    const handlePlaceOrder = () => {
        if (cartItems.length === 0) {
            toast.error("Your cart is empty");
            return;
        }

        if (!paymentMethod) {
            toast.error("Please select a payment method");
            return;
        }

        if (paymentMethod === "cash" && payment < amountDue) {
            toast.error("Payment amount is less than total amount due");
            return;
        }

        setIsPlacingOrder(true);
        setHasAutoPrinted(false);

        const orderData = {
            payment_method: paymentMethod,
            od_amount_due: subTotal,
            od_discount: discount,
            od_total_amt_due: amountDue,
            od_payment: payment,
            od_change: change,
            items: cartItems.map(item => ({
                pd_id: item.pd_id,
                ct_qty: item.ct_qty,
                ct_price: Number(item.ct_price || item.pd_price),
            }))
        };

        console.log("Submitting order data:", orderData);

        router.post(
            route("order.place", table_id),
            orderData,
            {
                preserveScroll: true,
                preserveState: false,
                onSuccess: (response) => {
                    console.log("Order placed successfully, response:", response);
                    setIsPlacingOrder(false);
                    
                    // Show success toast
                    toast.success("Order placed successfully!");
                    
                    // The page will reload and the useEffect will catch the flash data
                },
                onError: (errors) => {
                    setIsPlacingOrder(false);
                    console.error("Order errors:", errors);
                    const errorMessage = Object.values(errors)[0] || "Failed to place order";
                    toast.error(errorMessage);
                },
                onFinish: () => {
                    setIsPlacingOrder(false);
                },
            }
        );
    };

    const handlePrintReceipt = () => {
        if (lastOrder && lastOrder.od_id) {
            window.open(route('order.print', lastOrder.od_id), '_blank');
        } else {
            toast.error("No order to print");
        }
    };

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        setLastOrder(null);
    };

    return (
        <>
            <LoadingOverlay isVisible={isPlacingOrder} message="Processing your order..." />

            {/* Success Modal */}
            {showSuccessModal && lastOrder && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="inline-flex p-3 bg-green-100 rounded-full mb-4">
                                <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                Order Placed Successfully!
                            </h3>
                            <p className="text-gray-500">
                                Invoice #{lastOrder.invoice_no || 'N/A'}
                            </p>
                            <p className="text-xs text-blue-500 mt-2">
                                {hasAutoPrinted ? "Receipt printed" : "Receipt is printing automatically..."}
                            </p>
                        </div>
                        
                        <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Table:</span>
                                <span className="font-bold">Table {lastOrder.table_number || tableNumber}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Payment:</span>
                                <span className="font-bold capitalize">{lastOrder.payment_method || paymentMethod}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span className="text-gray-600">Items:</span>
                                <span className="font-bold">{lastOrder.items?.length || itemCount} items</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                                <span className="font-medium">Total:</span>
                                <span className="text-xl font-bold text-green-600">
                                    ₱{parseFloat(lastOrder.od_total_amt_due || amountDue).toFixed(2)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <Button
                                onClick={handlePrintReceipt}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3"
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                {hasAutoPrinted ? "Print Again" : "Print Receipt"}
                            </Button>
                            <Button
                                onClick={handleCloseSuccessModal}
                                variant="outline"
                                className="flex-1"
                            >
                                Continue
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Card className="sticky top-2">
                <CardContent className="pt-4">
                    <div className="space-y-6 mb-4">
                        {/* Header */}
                        <div className="border-b pb-4 flex items-center justify-between">
                            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                                <span className="text-xl font-bold text-red-700">
                                    {tableNumber}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Order Summary
                            </h2>
                            <Badge variant="secondary" className="px-3 py-1">
                                {itemCount} {itemCount === 1 ? "item" : "items"}
                            </Badge>
                        </div>

                        {/* Cart Items List */}
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {cartItems.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">
                                    Your cart is empty
                                </p>
                            ) : (
                                cartItems.map((product) => {
                                    const productId = product.pd_id || product.id;
                                    const productName = product.pd_name || product.name;
                                    const productImage = product.pd_image || product.image;
                                    const productPrice = Number(product.pd_price || product.ct_price || 0);
                                    const quantity = product.ct_qty || 1;
                                    const isLoading = loadingItem === productId;

                                    return (
                                        <div key={productId} className="rounded-lg border p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                {productImage && (
                                                    <div className="w-12 h-12 rounded-lg overflow-hidden">
                                                        <img
                                                            src={`/storage/${productImage}`}
                                                            alt={productName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <h3 className="font-medium text-gray-900 flex-1 ml-2">
                                                    {productName}
                                                </h3>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-gray-400 hover:text-red-600"
                                                    onClick={() => removeItem(productId)}
                                                    disabled={isLoading}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-green-600">
                                                    ₱{productPrice.toFixed(2)}
                                                </span>
                                                <div className="flex items-center space-x-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full"
                                                        onClick={() => updateQuantity(productId, -1)}
                                                        disabled={quantity <= 1 || isLoading}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-8 text-center font-medium">
                                                        {quantity}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full"
                                                        onClick={() => updateQuantity(productId, 1)}
                                                        disabled={isLoading}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <span className="text-sm font-bold text-green-600">
                                                    ₱{(productPrice * quantity).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Totals - Only show when cart has items */}
                        {cartItems.length > 0 && (
                            <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="font-bold">₱{subTotal.toFixed(2)}</span>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <span>Discount:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-500">-₱{discount.toFixed(2)}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max={subTotal}
                                          
                                            onChange={(e) => setDiscount(Math.min(Number(e.target.value) || 0, subTotal))}
                                            className="w-20 px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                                            placeholder="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between pt-3 pb-3 border-t border-b">
                                    <span className="text-lg font-bold">Total Amount Due:</span>
                                    <span className="text-lg font-bold text-green-600">
                                        ₱{amountDue.toFixed(2)}
                                    </span>
                                </div>

                                {paymentMethod === "cash" && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span>Payment:</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                 
                                                    onChange={(e) => setPayment(Number(e.target.value) || 0)}
                                                    className="w-20 px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                                                    placeholder="0"
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-3">
                                            <span className="text-md font-bold">Change:</span>
                                            <span className="text-md font-bold">
                                                ₱{change.toFixed(2)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Payment Methods */}
                        {cartItems.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-3">Payment Method</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setPaymentMethod("cash");
                                            setPayment(0);
                                        }}
                                        className={`p-4 border-2 rounded-xl ${
                                            paymentMethod === "cash"
                                                ? "border-green-500 bg-green-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        <Banknote className={`w-6 h-6 mx-auto mb-2 ${
                                            paymentMethod === "cash" ? "text-green-600" : "text-gray-600"
                                        }`} />
                                        <span className={`font-medium ${
                                            paymentMethod === "cash" ? "text-green-700" : "text-gray-700"
                                        }`}>Cash</span>
                                    </button>
                                    
                                    <button
                                        onClick={() => {
                                            setPaymentMethod("gcash");
                                            setPayment(amountDue);
                                        }}
                                        className={`p-4 border-2 rounded-xl ${
                                            paymentMethod === "gcash"
                                                ? "border-blue-500 bg-blue-50"
                                                : "border-gray-200 hover:bg-gray-50"
                                        }`}
                                    >
                                        <Smartphone className={`w-6 h-6 mx-auto mb-2 ${
                                            paymentMethod === "gcash" ? "text-blue-600" : "text-gray-600"
                                        }`} />
                                        <span className={`font-medium ${
                                            paymentMethod === "gcash" ? "text-blue-700" : "text-gray-700"
                                        }`}>GCash</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Place Order Button */}
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 h-12 text-base rounded-full"
                            disabled={cartItems.length === 0 || isPlacingOrder
                                || (paymentMethod === "cash" && payment < amountDue)
                            }
                            onClick={handlePlaceOrder}
                        >
                            {isPlacingOrder ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Processing...</span>
                                </div>
                            ) : cartItems.length === 0 ? (
                                "Cart is Empty"
                            ) : (
                                `Place Order (₱${amountDue.toFixed(2)})`
                            )}
                        </Button>

                        {cartItems.length > 0 && paymentMethod === "cash" && payment < amountDue && payment > 0 && (
                            <p className="text-xs text-red-500 text-center mt-2">
                                Payment amount is less than total. Customer still owes ₱{(amountDue - payment).toFixed(2)}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    );
}