import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { useEffect } from "react";
import RegistrationForm from "./Partials/RegistrationForm";
import UsersTable from "./Partials/UsersTable";

export default function Index({ branches, roles, users, filters }) {
    useEffect(() => {
        if (window.location.hash === "#user-registration") {
            document.getElementById("user-registration")?.scrollIntoView({
                behavior: "smooth",
            });
        }
    }, []);

    return (
        <AuthenticatedLayout>
            <Head title="User Management" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            User Management
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Register users and manage accounts by role and branch
                        </p>
                    </div>

                    <RegistrationForm branches={branches} roles={roles} />
                    <UsersTable
                        users={users}
                        branches={branches}
                        roles={roles}
                        filters={filters}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
