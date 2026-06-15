import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@inertiajs/react";
import { useEffect } from "react";
export default function CardTable({ children, tables = [], table_ids = [], table_item_counts = {} }) {
    const occupiedTableIds = new Set(table_ids);
    
    return (
        <div className="rounded-sm text-card-foreground">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {tables.map((table) => {
                    const isTableOccupied = occupiedTableIds.has(table.table_id);
                    const itemCount = table_item_counts[table.table_id] || 0;
                    
                    return (
                        <Card
                            key={table.table_id}
                            className={`cursor-pointer transition-all hover:scale-105 ${
                                isTableOccupied
                                    ? "border-red-200 bg-red-50"
                                    : "border-green-200 bg-green-50"
                            }`}
                        >
                            <CardContent className="p-6 text-center">
                                <div className="space-y-3">
                                    <div
                                        className={`inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto ${
                                            isTableOccupied
                                                ? "bg-red-100 text-red-700"
                                                : "bg-green-100 text-green-700"
                                        }`}
                                    >
                                        <span className="text-2xl font-bold">
                                            {table.t_number}
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-gray-900">
                                            {table.t_description || `Table ${table.t_number}`}
                                        </h3>
                                        <Badge
                                            variant={
                                                isTableOccupied
                                                    ? "destructive"
                                                    : "outline"
                                            }
                                            className={`mt-2 ${
                                                isTableOccupied 
                                                    ? "" 
                                                    : "bg-green-600 text-white border-green-600"
                                            }`}
                                        >
                                            {isTableOccupied 
                                                ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` 
                                                : "Available"}
                                        </Badge>
                                    </div>
                                    
                                    <Link href={route("menu.menu", table.table_id)}>
                                        <Button
                                            variant={
                                                isTableOccupied
                                                    ? "default"
                                                    : "outline"
                                            }
                                            className="w-full mt-2"
                                        >
                                            {isTableOccupied
                                                ? "View Order"
                                                : "Add Order"}
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}