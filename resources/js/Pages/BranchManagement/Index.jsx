import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AddModal from "./Partials/AddModal";
import BranchesTable from "./Partials/BranchesTable";
import { useBranchAlerts } from "./Hooks/useBranchAlerts";

export default function Index({ branches }) {
    useBranchAlerts();

    return (
        <AuthenticatedLayout>
            <Head title="Branch Management" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white">
                                Branch Management
                            </h1>
                            <p className="mt-2 text-sm text-white">
                                Manage branches for user assignment across the
                                system
                            </p>
                        </div>

                        <AddModal>
                            <Button
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Add Branch
                            </Button>
                        </AddModal>
                    </div>

                    <BranchesTable branches={branches} />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
