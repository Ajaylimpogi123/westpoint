import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router } from "@inertiajs/react";
import { useForm, usePage } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Plus, Trash, Edit, Search } from "lucide-react";
import AddModal from "./Partials/AddModal";
import React from "react";
import { DataTable } from "./Partials/DataTable";
import { columns } from "./Partials/Columns";

export default function Index({ orders }) {
    const orderData =
        orders.map((order) => ({
            od_id: order.od_id,
            invoice_no: order.invoice_no,
            created_at: order.created_at,
            cust_fullname: order.customer?.cust_fname ?? '' + order.customer?.cust_lname ?? '',
            table_number: order.table_number,
            od_total_amt_due: order.od_total_amt_due,
            payment_method: order.payment_method,
        })) || [];

// console.log("data", orderData);

    // const handleDelete = (table_id) => {
    //     if (confirm("Are you sure you want to delete this table?")) {
    //         destroy(route("table.destroy", table_id), {
    //             preserveScroll: true,
    //             onSuccess: () => {
    //                 // Optional: Show success message
    //             },
    //         });
    //     }
    // };

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
                                    Order History
                                </h1>
                                {/* <p className="mt-2 text-sm text-gray-600">
                                    Manage your tables and organization
                                </p> */}
                            </div>

                            {/* Add Category Button */}
                            <AddModal>
                                {" "}
                                <Button
                                    size="sm"
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Table
                                </Button>
                            </AddModal>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="rounded-sm border bg-card text-card-foreground shadow">
                        <div className="p-6">
                            <DataTable
                                columns={columns}
                                data={orderData}
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
