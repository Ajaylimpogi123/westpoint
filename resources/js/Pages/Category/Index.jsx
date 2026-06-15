import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router } from "@inertiajs/react";
import { useForm, usePage } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Plus, Trash, Edit, Search } from "lucide-react";
import AddModal from "./Partials/AddModal";
import React from "react";
import { DataTable } from "./Partials/DataTable";
import { columns } from "./Partials/Columns";
export default function Index({ categories, filters }) {
    const categoryData =
        categories.map((categories) => ({
            cat_id: categories.cat_id,
            cat_name: categories.cat_name,
            cat_description: categories.cat_description,
            cat_image: categories.cat_image,
        })) || [];

    const {
        data,
        setData,
        delete: destroy,
        processing,
    } = useForm({
        search: filters.search || "",
    });

    // Debounced search function
    const handleSearch = (e) => {
        const value = e.target.value;
        setData("search", value);

        router.get(
            route("category.index"),
            { search: value },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["categories", "filters"],
            },
        );
    };

    const clearSearch = () => {
        setData("search", "");
        router.get(
            route("category.index"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const handleDelete = (cat_id) => {
        if (confirm("Are you sure you want to delete this category?")) {
            destroy(route("category.destroy", cat_id), {
                preserveScroll: true,
                onSuccess: () => {
                    // Optional: Show success message
                },
            });
        }
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
                                    Categories
                                </h1>
                                <p className="mt-2 text-sm text-white">
                                    Manage your product categories and
                                    organization
                                </p>
                            </div>

                            {/* Add Category Button */}
                            <AddModal>
                                {" "}
                                <Button
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Category
                                </Button>
                            </AddModal>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="rounded-sm border bg-card text-card-foreground shadow">
                        <div className="p-6">
                            <DataTable
                                columns={columns}
                                data={categoryData}
                                searchable={true}
                                pagination={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
