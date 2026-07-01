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
import StockOutViewModal from "./StockOutViewModal";

const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
};

export default function StockOutHistoryTable({ stockOuts, filters }) {
    const goToPage = (page) => {
        router.get(
            route("medicine-inventory.index"),
            { ...filters, stock_out_page: page },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["stockOuts"],
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
                            <TableHead>Subtype</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Issued By</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stockOuts?.data?.length ? (
                            stockOuts.data.map((stockOut) => (
                                <TableRow key={stockOut.stock_out_id}>
                                    <TableCell className="font-medium">
                                        #{stockOut.stock_out_id}
                                    </TableCell>
                                    <TableCell>
                                        {stockOut.transaction_subtype}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(stockOut.created_at)}
                                    </TableCell>
                                    <TableCell>{stockOut.issued_by}</TableCell>
                                    <TableCell className="text-right">
                                        <StockOutViewModal
                                            stockOutId={stockOut.stock_out_id}
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
                                        </StockOutViewModal>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="h-24 text-center text-sm text-muted-foreground"
                                >
                                    No stock-out transactions recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {stockOuts?.data?.length > 0 && stockOuts.last_page > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {stockOuts.from ?? 0} to {stockOuts.to ?? 0} of{" "}
                        {stockOuts.total ?? 0} transactions
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                goToPage(stockOuts.current_page - 1)
                            }
                            disabled={stockOuts.current_page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {stockOuts.current_page} of{" "}
                            {stockOuts.last_page}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                goToPage(stockOuts.current_page + 1)
                            }
                            disabled={
                                stockOuts.current_page >= stockOuts.last_page
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
