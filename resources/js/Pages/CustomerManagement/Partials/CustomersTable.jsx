import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { router } from "@inertiajs/react";
import CustomerTypeBadge from "./CustomerTypeBadge";
import StatusBadge from "./StatusBadge";

export default function CustomersTable({
    customers,
    branches,
    filters,
    canFilterBranches,
}) {
    const applyFilters = (overrides = {}) => {
        router.get(
            route("customer-management.index"),
            {
                search: overrides.search ?? filters?.search ?? "",
                branch_id: overrides.branch_id ?? filters?.branch_id ?? "",
                page: 1,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["customers", "filters"],
            },
        );
    };

    const goToPage = (page) => {
        router.get(
            route("customer-management.index"),
            {
                search: filters?.search ?? "",
                branch_id: filters?.branch_id ?? "",
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["customers", "filters"],
            },
        );
    };

    const hasActiveFilters = filters?.search || filters?.branch_id;

    const clearFilters = () => {
        router.get(
            route("customer-management.index"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["customers", "filters"],
            },
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Customer Directory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <Input
                        placeholder="Search by name or phone number..."
                        defaultValue={filters?.search || ""}
                        className="max-w-sm"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                applyFilters({ search: e.target.value });
                            }
                        }}
                    />

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                        {canFilterBranches && (
                            <div className="flex flex-col gap-1">
                                <label
                                    htmlFor="customer-branch-filter"
                                    className="text-xs font-medium text-muted-foreground"
                                >
                                    Branch
                                </label>
                                <select
                                    id="customer-branch-filter"
                                    className="flex h-10 w-full min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={filters?.branch_id || ""}
                                    onChange={(e) =>
                                        applyFilters({
                                            branch_id: e.target.value,
                                        })
                                    }
                                >
                                    <option value="">All Branches</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.branch_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {hasActiveFilters && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone Number</TableHead>
                                {canFilterBranches && (
                                    <TableHead>Branch</TableHead>
                                )}
                                <TableHead>Customer Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.data.length ? (
                                customers.data.map((customer) => (
                                    <TableRow key={customer.customer_id}>
                                        <TableCell>
                                            {customer.first_name}{" "}
                                            {customer.last_name}
                                        </TableCell>
                                        <TableCell>
                                            {customer.phone_number || "-"}
                                        </TableCell>
                                        {canFilterBranches && (
                                            <TableCell>
                                                {customer.branch?.branch_name ||
                                                    "-"}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <CustomerTypeBadge
                                                type={customer.customer_type}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={customer.status}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                            >
                                                Edit
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={canFilterBranches ? 6 : 5}
                                        className="h-24 text-center"
                                    >
                                        No customers found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                        Showing {customers.from ?? 0} to {customers.to ?? 0} of{" "}
                        {customers.total ?? 0} customers
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(customers.current_page - 1)}
                            disabled={customers.current_page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {customers.current_page} of{" "}
                            {customers.last_page}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(customers.current_page + 1)}
                            disabled={
                                customers.current_page >= customers.last_page
                            }
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
