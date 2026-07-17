import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { router } from "@inertiajs/react";
import { Eye, Printer } from "lucide-react";
import StockOutViewModal from "./StockOutViewModal";

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
};

export default function StockOutHistoryTable({ stockOuts, filters }) {
    const perPage = Number(filters?.stock_out_per_page) || 10;

    const reload = (params) => {
        router.get(
            route("medicine-inventory.index"),
            {
                ...filters,
                stock_out_per_page: perPage,
                ...params,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["stockOuts", "filters"],
            },
        );
    };

    const goToPage = (page) => {
        reload({ stock_out_page: page });
    };

    const changePerPage = (value) => {
        reload({
            stock_out_per_page: value,
            stock_out_page: 1,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold">Transaction History</h3>

                <div className="flex items-center gap-2">
                    <Label
                        htmlFor="stock_out_per_page"
                        className="text-sm text-muted-foreground"
                    >
                        Per page
                    </Label>
                    <select
                        id="stock_out_per_page"
                        value={perPage}
                        onChange={(event) =>
                            changePerPage(Number(event.target.value))
                        }
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                        {PER_PAGE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

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
                                        <div className="flex items-center justify-end gap-2">
                                            <StockOutViewModal
                                                stockOutId={
                                                    stockOut.stock_out_id
                                                }
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
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1"
                                                onClick={() =>
                                                    window.open(
                                                        route(
                                                            "stock-out.receipt",
                                                            stockOut.stock_out_id,
                                                        ),
                                                        "_blank",
                                                        "noopener,noreferrer",
                                                    )
                                                }
                                            >
                                                <Printer className="h-3.5 w-3.5" />
                                                Receipt
                                            </Button>
                                        </div>
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

            {stockOuts?.data?.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {stockOuts.from ?? 0} to {stockOuts.to ?? 0} of{" "}
                        {stockOuts.total ?? 0} transactions
                    </p>
                    {stockOuts.last_page > 1 && (
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
                    )}
                </div>
            )}
        </div>
    );
}
