import InputLabel from "@/Components/InputLabel";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { router, useForm } from "@inertiajs/react";
import { useEffect } from "react";

export default function UsersTable({ users, branches, roles, filters }) {
    const { data: filterData, setData: setFilterData } = useForm({
        role_id: filters?.role_id || "",
        branch_id: filters?.branch_id || "",
    });

    useEffect(() => {
        setFilterData({
            role_id: filters?.role_id || "",
            branch_id: filters?.branch_id || "",
        });
    }, [filters]);

    const applyFilters = (overrides = {}) => {
        router.get(
            route("user-management.index"),
            {
                role_id: overrides.role_id ?? filterData.role_id,
                branch_id: overrides.branch_id ?? filterData.branch_id,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["users", "filters"],
            },
        );
    };

    const clearFilters = () => {
        setFilterData({ role_id: "", branch_id: "" });
        router.get(
            route("user-management.index"),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["users", "filters"],
            },
        );
    };

    const goToPage = (page) => {
        router.get(
            route("user-management.index"),
            {
                role_id: filterData.role_id,
                branch_id: filterData.branch_id,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["users", "filters"],
            },
        );
    };

    const hasActiveFilters = filterData.role_id || filterData.branch_id;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <InputLabel htmlFor="filter_role" value="Filter by Role" />
                        <select
                            id="filter_role"
                            value={filterData.role_id}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            onChange={(e) => {
                                const role_id = e.target.value;
                                setFilterData("role_id", role_id);
                                applyFilters({ role_id });
                            }}
                        >
                            <option value="">All Roles</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.role_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1">
                        <InputLabel htmlFor="filter_branch" value="Filter by Branch" />
                        <select
                            id="filter_branch"
                            value={filterData.branch_id}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            onChange={(e) => {
                                const branch_id = e.target.value;
                                setFilterData("branch_id", branch_id);
                                applyFilters({ branch_id });
                            }}
                        >
                            <option value="">All Branches</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.branch_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {hasActiveFilters && (
                        <Button type="button" variant="outline" onClick={clearFilters}>
                            Clear Filters
                        </Button>
                    )}
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Branch</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.data.length ? (
                                users.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            {user.role?.role_name || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {user.branch?.branch_name || "-"}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                        Showing {users.from ?? 0} to {users.to ?? 0} of{" "}
                        {users.total ?? 0} users
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(users.current_page - 1)}
                            disabled={users.current_page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {users.current_page} of {users.last_page}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(users.current_page + 1)}
                            disabled={users.current_page >= users.last_page}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
