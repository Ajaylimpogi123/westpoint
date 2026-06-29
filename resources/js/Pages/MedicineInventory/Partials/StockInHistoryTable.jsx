import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { router } from "@inertiajs/react";
import { Eye } from "lucide-react";
import StockInViewModal from "./StockInViewModal";

const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
};

export default function StockInHistoryTable({ stockIns, filters }) {
    const goToPage = (page) => {
        router.get(
            route("medicine-inventory.index"),
            { ...filters, stock_in_page: page },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["stockIns"],
            },
        );
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold">Transaction History</h3>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Received By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stockIns?.data?.length ? (
                            stockIns.data.map((stockIn) => (
                                <TableRow key={stockIn.stock_in_id}>
                                    <TableCell className="font-medium">
                                        #{stockIn.stock_in_id}
                                    </TableCell>
                                    <TableCell>
                                        {stockIn.supplier_name}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(stockIn.delivery_date)}
                                    </TableCell>
                                    <TableCell>{stockIn.received_by}</TableCell>
                                    <TableCell className="text-right">
                                        <StockInViewModal
                                            stockInId={stockIn.stock_in_id}
                                        >
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                View
                                            </Button>
                                        </StockInViewModal>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="h-24 text-center text-sm text-muted-foreground"
                                >
                                    No stock-in transactions recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {stockIns?.data?.length > 0 && stockIns.last_page > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {stockIns.from ?? 0} to {stockIns.to ?? 0} of{" "}
                        {stockIns.total ?? 0} transactions
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                goToPage(stockIns.current_page - 1)
                            }
                            disabled={stockIns.current_page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {stockIns.current_page} of {stockIns.last_page}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                goToPage(stockIns.current_page + 1)
                            }
                            disabled={
                                stockIns.current_page >= stockIns.last_page
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
