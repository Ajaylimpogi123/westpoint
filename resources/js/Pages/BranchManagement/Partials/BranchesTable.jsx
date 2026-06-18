import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/Components/ui/card";
import { router, useForm } from "@inertiajs/react";
import { Pencil, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import EditModal from "./EditModal";

export default function BranchesTable({ branches }) {
    const { delete: destroy } = useForm();

    const goToPage = (page) => {
        router.get(
            route("branch-management.index"),
            { page },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["branches"],
            },
        );
    };

    const handleDelete = (branch) => {
        Swal.fire({
            title: "Delete Branch?",
            text: `Are you sure you want to delete "${branch.branch_name}"? This action can be undone from the database.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Delete",
        }).then((result) => {
            if (result.isConfirmed) {
                destroy(route("branch-management.destroy", branch.id), {
                    preserveScroll: true,
                    only: ["branches"],
                });
            }
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Branch Name</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {branches.data.length ? (
                                branches.data.map((branch) => (
                                    <TableRow key={branch.id}>
                                        <TableCell className="font-medium">
                                            {branch.branch_name}
                                        </TableCell>
                                        <TableCell>
                                            {formatDate(branch.created_at)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <EditModal branch={branch}>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        Edit
                                                    </Button>
                                                </EditModal>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                    onClick={() =>
                                                        handleDelete(branch)
                                                    }
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="h-24 text-center"
                                    >
                                        No branches found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                        Showing {branches.from ?? 0} to {branches.to ?? 0} of{" "}
                        {branches.total ?? 0} branches
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(branches.current_page - 1)}
                            disabled={branches.current_page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {branches.current_page} of {branches.last_page}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => goToPage(branches.current_page + 1)}
                            disabled={
                                branches.current_page >= branches.last_page
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
