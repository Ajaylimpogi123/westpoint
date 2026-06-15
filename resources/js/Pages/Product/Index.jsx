import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import { useForm } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AddModal from "./Partials/AddModal";
import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select";

import Card from "./Partials/Card";
import { handler } from "tailwindcss-animate";
export default function Index({ products, categories, filters }) {
    const {
        data,
        setData,
        delete: destroy,
        processing,
    } = useForm({
        search: filters.search || "",
        category: filters.category || "all",
    });

    // Debounced search function
    const handleSearch = (e) => {
        const value = e.target.value;
        setData("search", value);
        router.get(
            route("product.index"),
            { search: value, category: data.category },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["products", "filters"],
            },
        );
    };

    const handleCategoryChange = (value) => {
        setData("category", value);
        router.get(
            route("product.index"),
            { search: data.search, category: value },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["products", "filters"],
            },
        );
    };

    const clearSearch = () => {
        setData("search", "");
        router.get(
            route("product.index"),
            { search: "", category: data.category },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["product", "filters"],
            },
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title="Contact Page" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight text-white">
                                    Products
                                </h1>
                                <p className="mt-2 text-sm text-white">
                                    Manage your products and organization
                                </p>
                            </div>
                            <AddModal categories={categories}>
                                {" "}
                                <Button
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Product
                                </Button>
                            </AddModal>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="rounded-sm border bg-card text-card-foreground shadow">
                        <div className="p-6">
                            {/* Search and Filters */}
                            <div className="flex  flex-col gap-2 md:flex-row md:items-center">
                                <div className="relative w-full md:w-96 mb-6">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="text"
                                        value={data.search}
                                        onChange={handleSearch}
                                        placeholder="Search Product..."
                                        className="pl-9 pr-9"
                                    />

                                    {/* Clear Button */}
                                    {data.search && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={clearSearch}
                                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                        >
                                            <X className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    )}
                                </div>
                                <div className="relative w-full md:w-96 mb-6">
                                    <Select
                                        value={data.category}
                                        onValueChange={handleCategoryChange}
                                    >
                                        <SelectTrigger className="w-full max-w-48">
                                            <SelectValue placeholder="Select a Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>
                                                    Category
                                                </SelectLabel>
                                                <SelectItem value="all">
                                                    All Category
                                                </SelectItem>
                                                {categories.map((category) => (
                                                    <SelectItem
                                                        key={category.cat_id}
                                                        value={category.cat_id}
                                                    >
                                                        {category.cat_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {/* Content Grid */}
                            <Card products={products} categories={categories} />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
