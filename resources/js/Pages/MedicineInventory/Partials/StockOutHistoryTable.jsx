import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { router, usePage } from "@inertiajs/react";
import { CheckCircle2, Eye, Printer, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import StockOutViewModal from "./StockOutViewModal";
import { formatDate } from "@/lib/dates";
import StockOutEditModal from "./StockOutEditModal";
import {
    DELIVERY_TO_CUSTOMER,
    RETURNED_TO_SUPPLIER,
} from "../lib/stockOutValidation";

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

// Delete/confirm change stock, so refresh stock too; "flash" carries the
// success or refusal message.
const RELOAD_PROPS = ["stockOuts", "medicines", "products", "movementLogs", "flash"];

/** Mirrors StockOutController::isEditable(): not yet a sale, not legacy. */
function isEditable(stockOut) {
    return (
        (stockOut.transaction_subtype === DELIVERY_TO_CUSTOMER &&
            !stockOut.delivery_confirmed) ||
        stockOut.transaction_subtype === RETURNED_TO_SUPPLIER
    );
}

export default function StockOutHistoryTable({
    stockOuts,
    filters,
    canViewAllBranches = false,
    branches = [],
}) {
    const { auth } = usePage().props;
    // Deleting is admin/superadmin only (route middleware role:2,3).
    const canDelete = [2, 3].includes(Number(auth?.user?.role_id));
    const perPage = Number(filters?.stock_out_per_page) || 10;
    const branchFilter = filters?.stock_out_branch_id ?? "all";

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

    const changeBranchFilter = (value) => {
        reload({
            stock_out_branch_id: value,
            stock_out_page: 1,
        });
    };

    const addToSales = async (stockOutId) => {
        const result = await Swal.fire({
            icon: "question",
            title: "Confirm Delivery",
            text: "Confirm that the patient has received this delivery? This will record it as a completed sale.",
            showCancelButton: true,
            confirmButtonText: "Yes, confirm",
            confirmButtonColor: "#16a34a",
            cancelButtonText: "Cancel",
        });

        if (!result.isConfirmed) {
            return;
        }

        router.post(
            route("stock-out.confirm-delivery", stockOutId),
            {},
            {
                preserveScroll: true,
                only: RELOAD_PROPS,
            },
        );
    };

    const deleteStockOut = async (stockOut) => {
        const isReturn =
            stockOut.transaction_subtype === RETURNED_TO_SUPPLIER;

        const result = await Swal.fire({
            icon: "warning",
            title: `Delete Stock Out #${stockOut.stock_out_id}?`,
            text: isReturn
                ? "Its pieces will be put back into their lots. This cannot be undone."
                : "No stock was deducted for this delivery yet. This cannot be undone.",
            showCancelButton: true,
            confirmButtonText: "Yes, delete",
            confirmButtonColor: "#dc2626",
            cancelButtonText: "Cancel",
            focusCancel: true,
        });

        if (!result.isConfirmed) {
            return;
        }

        router.delete(route("stock-out.destroy", stockOut.stock_out_id), {
            preserveScroll: true,
            only: RELOAD_PROPS,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold">Transaction History</h3>

                <div className="flex flex-wrap items-center gap-3">
                    {canViewAllBranches && (
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="stock_out_branch_id"
                                className="text-sm text-muted-foreground"
                            >
                                Branch
                            </Label>
                            <Select
                                value={branchFilter}
                                onValueChange={changeBranchFilter}
                            >
                                <SelectTrigger
                                    id="stock_out_branch_id"
                                    className="h-9 w-[180px]"
                                >
                                    <SelectValue placeholder="All branches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All branches
                                    </SelectItem>
                                    {branches.map((branch) => (
                                        <SelectItem
                                            key={branch.id}
                                            value={String(branch.id)}
                                        >
                                            {branch.branch_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Subtype</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Issued By</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
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
                                    <TableCell>
                                            {stockOut.branch?.branch_name ??
                                                "—"}
                                        </TableCell>
                                    <TableCell>{stockOut.issued_by}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canDelete && isEditable(stockOut) && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    onClick={() =>
                                                        deleteStockOut(stockOut)
                                                    }
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </Button>
                                            )}

                                            {isEditable(stockOut) && (
                                                    <StockOutEditModal
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
                                                            Edit
                                                        </Button>
                                                    </StockOutEditModal>
                                                )}

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
                                            {stockOut.delivery_confirmed ? (
                                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Added to Sales
                                                </span>
                                            ) : (
                                                stockOut.transaction_subtype ===
                                                    DELIVERY_TO_CUSTOMER && (
                                                    <Button
                                                        type="button"
                                                        variant="default"
                                                        size="sm"
                                                        className="flex items-center gap-1"
                                                        onClick={() =>
                                                            addToSales(
                                                                stockOut.stock_out_id,
                                                            )
                                                        }
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Add to Sales
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
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
                                    stockOuts.current_page >=
                                    stockOuts.last_page
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
