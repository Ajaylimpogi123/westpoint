import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import AddModal from "./Partials/AddModal";
import MedicinesTable from "./Partials/MedicinesTable";
import { useMedicineAlerts } from "./Hooks/useMedicineAlerts";

export default function Index({ medicines, filters, branchId, canEditMedicine }) {
    useMedicineAlerts();

    return (
        <AuthenticatedLayout>
            <Head title="Medicine Inventory" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white">
                                Medicine Inventory
                            </h1>
                            <p className="mt-2 text-sm text-white">
                                Manage medicines and branch stock batches.
                                Expand a row to view lot breakdown and intake
                                tools.
                            </p>
                        </div>

                        <AddModal>
                            <Button
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Add Medicine
                            </Button>
                        </AddModal>
                    </div>

                    <MedicinesTable
                        medicines={medicines}
                        filters={filters}
                        branchId={branchId}
                        canEditMedicine={canEditMedicine}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
