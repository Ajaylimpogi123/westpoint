import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye, MoreVertical } from "lucide-react";
import EditModal from "./EditModal";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export default function Card({ children, products, categories }) {
    const handleDelete = (pd_id) => {
        if (confirm("Are you sure you want to delete this contact?")) {
            destroy(route("product.destroy", pd_id), {
                preserveScroll: true,
                onSuccess: () => {
                    // Optional: Show success message
                    Alert("Product deleted successfully.");
                },
            });
        }
    };
    return (
        <div className="rounded-sm  bg-card text-card-foreground">
            <div>
                {/* <h2 className="text-lg font-semibold mb-2">Product Details</h2> */}

                {products.map((product) => (
                    <div
                        key={product.pd_id}
                        className="bg-white rounded-md shadow-sm border border-gray-200 p-2 mb-2 hover:shadow-md transition-all"
                    >
                        <div className="flex flex-col lg:flex-row gap-2">
                            {/* Image - Top on mobile, left on desktop */}
                            <div className="lg:w-1/6">
                                <div className="relative aspect-square w-full max-w-[130px] mx-auto lg:mx-0">
                                    {product.pd_image ? (
                                        <img
                                            src={`storage/${product.pd_image}`}
                                            alt={product.pd_name}
                                            className="rounded-lg object-cover w-full h-full"
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                            <svg
                                                className="w-16 h-16 text-gray-300"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm px-1.5 py-1 rounded text-xs font-semibold">
                                        {product.pd_qty} left
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 pt-1 space-y-1 justify-between items-start">
                                    {/* Header Row */}
                                    {/* Header Row */}
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-md font-bold text-gray-900">
                                                    {product.pd_name}
                                                </h3>
                                                <p className="text-sm text-gray-500">
                                                    - {product.pd_description}
                                                </p>
                                            </div>

                                            <div className="text-sm text-gray-500 mb-2">
                                                Category:{" "}
                                                {product.category?.cat_name ||
                                                    "N/A"}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0"
                                                >
                                                    <MoreVertical className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>
                                                    Actions
                                                </DropdownMenuLabel>

                                                <EditModal
                                                    product={product}
                                                    categories={categories}
                                                >
                                                    <div className="bg-indigo-50 text-indigo-700 text-xs hover:bg-indigo-100  pl-2 pr-4 py-2 rounded-md cursor-pointer flex items-center gap-2 mt-2">
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </div>
                                                </EditModal>

                                                <div
                                                    className="bg-red-50 text-red-700 text-xs  hover:bg-red-100  pl-2 pr-4 py-2 rounded-md cursor-pointer flex items-center gap-2 mt-2"
                                                    onClick={() =>
                                                        handleDelete(
                                                            product.pd_id,
                                                        )
                                                    }
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </div>
                                                <DropdownMenuItem>
                                                    {/* <div className="bg-indigo-50 text-indigo-700 text-sm  rounded-md hover:bg-indigo-100  pl-2 pr-4 py-2 rounded-md cursor-pointer flex items-center gap-2">
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </div> */}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                                    <div className="space-y-1">
                                        <div className="text-sm text-gray-500 uppercase tracking-wide">
                                            Price
                                        </div>
                                        <div className="font-semibold text-green-600">
                                            ₱{product.pd_price}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm text-gray-500 uppercase tracking-wide">
                                            All Stock
                                        </div>
                                        <div className="font-semibold">
                                            {product.pd_qty} pcs
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-sm text-gray-500 uppercase tracking-wide">
                                            Cost
                                        </div>
                                        <div className="font-semibold">
                                            ₱{product.pd_cost}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-sm text-gray-500 uppercase tracking-wide">
                                            Threshold
                                        </div>
                                        <div>{product.pd_mqty} pcs</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-sm px-2.5 text-gray-500 uppercase tracking-wide">
                                            Status
                                        </div>
                                        <span
                                            className={`
                                        inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium
                                        ${
                                            product.pd_qty === 0
                                                ? "bg-red-100 text-red-800"
                                                : product.pd_qty <=
                                                    product.pd_mqty
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-green-100 text-green-800"
                                        }
                                    `}
                                        >
                                            {product.pd_qty === 0
                                                ? "Out of Stock"
                                                : product.pd_qty <=
                                                    product.pd_mqty
                                                  ? "Low Stock"
                                                  : "In Stock"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div>{children}</div>
        </div>
    );
}
