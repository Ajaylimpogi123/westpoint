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
import StockInViewModal from "./StockInViewModal";
import { formatDate } from "@/lib/dates";

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

export default function StockInHistoryTable({ stockIns, filters }) {
    const perPage = Number(filters?.stock_in_per_page) || 10;

    const reload = (params) => {
        router.get(
            route("medicine-inventory.index"),
            {
                ...filters,
                stock_in_per_page: perPage,
                ...params,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["stockIns", "filters"],
            },
        );
    };

    const goToPage = (page) => {
        reload({ stock_in_page: page });
    };

    const changePerPage = (value) => {
        reload({
            stock_in_per_page: value,
            stock_in_page: 1,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold">Transaction History</h3>

                <div className="flex items-center gap-2">
                    <Label
                        htmlFor="stock_in_per_page"
                        className="text-sm text-muted-foreground"
                    >
                        Per page
                    </Label>
                    <select
                        id="stock_in_per_page"
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
                                        <div className="flex items-center justify-end gap-2">
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
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1"
                                                onClick={() =>
                                                    window.open(
                                                        route(
                                                            "stock-in.receipt",
                                                            stockIn.stock_in_id,
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
                                    No stock-in transactions recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {stockIns?.data?.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {stockIns.from ?? 0} to {stockIns.to ?? 0} of{" "}
                        {stockIns.total ?? 0} transactions
                    </p>
                    {stockIns.last_page > 1 && (
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
                                Page {stockIns.current_page} of{" "}
                                {stockIns.last_page}
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
                    )}
                </div>
            )}
        </div>
    );
}
