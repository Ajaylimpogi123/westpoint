import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head } from "@inertiajs/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Plus } from "lucide-react";
import AddModal from "./Partials/AddModal";
import MedicinesTable from "./Partials/MedicinesTable";
import NewTransactionsPanel from "./Partials/NewTransactionsPanel";
import MovementLogsPanel from "./Partials/MovementLogsPanel";
import { useMedicineAlerts } from "./Hooks/useMedicineAlerts";

export default function Index({
    medicines,
    filters,
    branchId,
    branchName,
    products,
    canEditMedicine,
}) {
    useMedicineAlerts();

    return (
        <AuthenticatedLayout>
            <Head title="Medicine Inventory" />

            <div className="relative z-10 py-8">
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Medicine Inventory
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Manage medicines, record stock movements, and review
                            inventory activity.
                        </p>
                    </div>

                    <Tabs defaultValue="inventory" className="space-y-6">
                        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-white/10 p-1 sm:grid-cols-3">
                            <TabsTrigger
                                value="transactions"
                                className="data-[state=active]:bg-white data-[state=active]:text-foreground"
                            >
                                New Transactions
                            </TabsTrigger>
                            <TabsTrigger
                                value="inventory"
                                className="data-[state=active]:bg-white data-[state=active]:text-foreground"
                            >
                                Inventory
                            </TabsTrigger>
                            <TabsTrigger
                                value="movement-logs"
                                className="data-[state=active]:bg-white data-[state=active]:text-foreground"
                            >
                                Movement Logs
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="transactions">
                            <NewTransactionsPanel
                                branchId={branchId}
                                branchName={branchName}
                                products={products}
                            />
                        </TabsContent>

                        <TabsContent value="inventory" className="space-y-6">
                            <div className="flex justify-end">
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
                        </TabsContent>

                        <TabsContent value="movement-logs">
                            <MovementLogsPanel />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
