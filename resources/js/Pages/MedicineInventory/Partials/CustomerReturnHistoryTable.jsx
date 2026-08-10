import { Button } from "@/Components/ui/button";
import { Label } from "@/Components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import { router } from "@inertiajs/react";
import { Eye, Printer } from "lucide-react";
import CustomerReturnViewModal from "./CustomerReturnViewModal";
import { formatDate } from "@/lib/dates";

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

export default function CustomerReturnHistoryTable({
    customerReturns,
    filters,
    canViewAllBranches = false,
    branches = [],
}) {
    const perPage = Number(filters?.return_per_page) || 10;
    const branchFilter = filters?.return_branch_id ?? "all";
    const showBranchColumn =
        canViewAllBranches && (branchFilter === "all" || branchFilter === "");

    const reload = (params) => {
        router.get(
            route("medicine-inventory.index"),
            { ...filters, return_per_page: perPage, ...params },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["customerReturns", "filters"],
            },
        );
    };

    const goToPage = (page) => reload({ return_page: page });
    const changePerPage = (value) =>
        reload({ return_per_page: value, return_page: 1 });
    const changeBranchFilter = (value) =>
        reload({ return_branch_id: value, return_page: 1 });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold">Return History</h3>
                <div className="flex flex-wrap items-center gap-3">
                    {canViewAllBranches && (
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="return_branch_id"
                                className="text-sm text-muted-foreground"
                            >
                                Branch
                            </Label>
                            <Select
                                value={branchFilter}
                                onValueChange={changeBranchFilter}
                            >
                                <SelectTrigger
                                    id="return_branch_id"
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
                            htmlFor="return_per_page"
                            className="text-sm text-muted-foreground"
                        >
                            Per page
                        </Label>
                        <select
                            id="return_per_page"
                            value={perPage}
                            onChange={(e) =>
                                changePerPage(Number(e.target.value))
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
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            {showBranchColumn && <TableHead>Branch</TableHead>}
                            <TableHead>Received By</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customerReturns?.data?.length ? (
                            customerReturns.data.map((item) => (
                                <TableRow key={item.return_id}>
                                    <TableCell className="font-medium">
                                        #{item.return_id}
                                    </TableCell>
                                    <TableCell>
                                        {item.customer
                                            ? `${item.customer.first_name} ${item.customer.last_name}`
                                            : "—"}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(item.return_date)}
                                    </TableCell>
                                    {showBranchColumn && (
                                        <TableCell>
                                            {item.branch?.branch_name ?? "—"}
                                        </TableCell>
                                    )}
                                    <TableCell>{item.received_by}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <CustomerReturnViewModal
                                                returnId={item.return_id}
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
                                            </CustomerReturnViewModal>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1"
                                                onClick={() =>
                                                    window.open(
                                                        route(
                                                            "customer-return.receipt",
                                                            item.return_id,
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
                                    colSpan={showBranchColumn ? 6 : 5}
                                    className="h-24 text-center text-sm text-muted-foreground"
                                >
                                    No returns recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {customerReturns?.data?.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {customerReturns.from ?? 0} to{" "}
                        {customerReturns.to ?? 0} of{" "}
                        {customerReturns.total ?? 0} returns
                    </p>
                    {customerReturns.last_page > 1 && (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    goToPage(customerReturns.current_page - 1)
                                }
                                disabled={customerReturns.current_page <= 1}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {customerReturns.current_page} of{" "}
                                {customerReturns.last_page}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    goToPage(customerReturns.current_page + 1)
                                }
                                disabled={
                                    customerReturns.current_page >=
                                    customerReturns.last_page
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
