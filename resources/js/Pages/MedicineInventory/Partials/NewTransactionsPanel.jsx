import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Plus } from "lucide-react";
import StockInModal from "./StockInModal";
import StockInHistoryTable from "./StockInHistoryTable";
import StockOutModal from "./StockOutModal";
import StockOutHistoryTable from "./StockOutHistoryTable";

export default function NewTransactionsPanel({
    branchId,
    branchName,
    products,
    stockIns,
    stockOuts,
    filters,
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <Tabs defaultValue="stock-in" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="stock-in">Stock In</TabsTrigger>
                        <TabsTrigger value="stock-out">Stock Out</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stock-in" className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Stock In Transactions
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Record supplier deliveries and update live
                                    inventory batches.
                                </p>
                            </div>

                            <StockInModal
                                branchId={branchId}
                                branchName={branchName}
                                products={products}
                            >
                                <Button className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add New Stock In
                                </Button>
                            </StockInModal>
                        </div>

                        {!branchId && (
                            <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                                Assign a branch to your account before recording
                                stock-in transactions.
                            </div>
                        )}

                        {branchId && (
                            <StockInHistoryTable
                                stockIns={stockIns}
                                filters={filters}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="stock-out" className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Stock Out Transactions
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Record stock deductions from branch inventory
                                    by lot.
                                </p>
                            </div>

                            <StockOutModal
                                branchId={branchId}
                                branchName={branchName}
                                products={products}
                            >
                                <Button className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add New Stock Out
                                </Button>
                            </StockOutModal>
                        </div>

                        {!branchId && (
                            <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                                Assign a branch to your account before recording
                                stock-out transactions.
                            </div>
                        )}

                        {branchId && (
                            <StockOutHistoryTable
                                stockOuts={stockOuts}
                                filters={filters}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
