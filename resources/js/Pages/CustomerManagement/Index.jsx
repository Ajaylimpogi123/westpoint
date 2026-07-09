import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import RegistrationForm from "./Partials/RegistrationForm";
import CustomersTable from "./Partials/CustomersTable";

export default function Index({
    customers,
    branches,
    filters,
    canFilterBranches,
    branchId,
    branchName,
}) {
    return (
        <AuthenticatedLayout>
            <Head title="Customer Management" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Customer Management
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Register customers and manage the customer
                            directory by branch
                        </p>
                    </div>

                    <RegistrationForm
                        branches={branches}
                        branchId={branchId}
                        branchName={branchName}
                    />
                    <CustomersTable
                        customers={customers}
                        branches={branches}
                        filters={filters}
                        canFilterBranches={canFilterBranches}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
