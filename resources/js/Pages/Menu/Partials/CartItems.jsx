import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";

// const [activeCategory, setActiveCategory] = useState("all");

export default function CartItems({ setCartItemsCount, cartOpen }) {
    const [cartItems, setCartItems] = useState([
        {
            id: 1,
            name: "Tasty Vegetable Salad Healthy Diet",
            price: 12.99,
            quantity: 1,
            type: "Veg",
            total: 12.99,
        },
        {
            id: 2,
            name: "Original Chess Meat Burger With Chips (Non Veg)",
            price: 23.99,
            quantity: 1,
            type: "Non Veg",
            total: 23.99,
        },
        {
            id: 3,
            name: "Tacos Salsa With Chickens Grilled",
            price: 14.99,
            quantity: 1,
            type: "Non Veg",
            total: 14.99,
        },
        {
            id: 4,
            name: "Fresh Orange Juice With Basil Seed No Sugar (Veg)",
            price: 12.99,
            quantity: 1,
            type: "Veg",
            total: 12.99,
        },
    ]);

    // Update cart count in parent and localStorage
    useEffect(() => {
        const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);

        // Update parent component
        if (setCartItemsCount) {
            setCartItemsCount(count);
        }

        // Dispatch event for other components
        window.dispatchEvent(
            new CustomEvent("cart-updated", {
                detail: { count },
            }),
        );

        // Save to localStorage for persistence
        localStorage.setItem("cartItems", JSON.stringify(cartItems));
    }, [cartItems, setCartItemsCount]);

    const updateQuantity = (id, change) => {
        setCartItems((items) =>
            items.map((item) =>
                item.id === id
                    ? {
                          ...item,
                          quantity: Math.max(1, item.quantity + change),
                          total:
                              item.price * Math.max(1, item.quantity + change),
                      }
                    : item,
            ),
        );
    };

    const removeItem = (id) => {
        setCartItems((items) => items.filter((item) => item.id !== id));
    };

    const addToCart = (item) => {
        const existingItem = cartItems.find(
            (cartItem) => cartItem.id === item.id,
        );

        if (existingItem) {
            updateQuantity(item.id, 1);
        } else {
            setCartItems([
                ...cartItems,
                {
                    ...item,
                    quantity: 1,
                    total: item.price,
                },
            ]);
        }
    };

    const subTotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
    );
    const tax = subTotal * 0.05;
    const total = subTotal + tax;
    <>
        <Card className="sticky top-20">
            <CardContent className="p-6">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="border-b pb-4 flex items-center justify-between">
                        <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mr-4">
                            <span className="text-xl font-bold text-red-700">
                                T4
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Order Summary
                        </h2>
                        <Badge variant="secondary" className="px-3 py-1">
                            {cartItems.reduce(
                                (sum, item) => sum + item.quantity,
                                0,
                            )}{" "}
                            items
                        </Badge>
                    </div>

                    {/* Cart Items */}
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {cartItems.map((item) => (
                            <div
                                key={item.id}
                                className="border-b pb-4 last:border-0 last:pb-0"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-medium text-gray-900">
                                            {item.name}
                                        </h3>
                                        {/* <Badge
                                            variant="outline"
                                            className={`mt-1 ${
                                                item.type === "Veg"
                                                    ? "bg-green-50 text-green-700 border-green-200"
                                                    : "bg-red-50 text-red-700 border-red-200"
                                            }`}
                                        >
                                            {item.type}
                                        </Badge> */}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-gray-400 hover:text-red-600"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-md font-bold text-gray-700">
                                        ${item.price.toFixed(2)}
                                    </span>

                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() =>
                                                updateQuantity(item.id, -1)
                                            }
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center font-medium">
                                            {item.quantity}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() =>
                                                updateQuantity(item.id, 1)
                                            }
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <span className="text-md font-bold text-gray-900">
                                        $
                                        {(item.price * item.quantity).toFixed(
                                            2,
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total Calculation */}
                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Sub Total</span>
                            <span className="font-medium">
                                ${subTotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax 5%</span>
                            <span className="font-medium">
                                ${tax.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between pt-3 border-t">
                            <span className="text-lg font-bold text-gray-900">
                                Total Amount
                            </span>
                            <span className="text-2xl font-bold text-red-600">
                                ${total.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-3">
                            Payment Method
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant="outline"
                                className="h-12 hover:bg-gray-50"
                            >
                                Cash
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 hover:bg-gray-50"
                            >
                                Credit/Debit Card
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 hover:bg-gray-50"
                            >
                                QR Code
                            </Button>
                        </div>
                    </div>

                    {/* Place Order Button */}
                    <Button className="w-full h-12 text-lg mt-4" size="lg">
                        Place Order
                    </Button>
                </div>
            </CardContent>
        </Card>
    </>;
}
