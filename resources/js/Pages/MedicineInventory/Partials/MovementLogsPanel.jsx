import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
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
import { Eye } from "lucide-react";
import {
    formatMovementQuantity,
    getMovementTypeLabel,
} from "../lib/movementLogLabels";
import MovementLogViewModal from "./MovementLogViewModal";

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

import { formatDateTime } from "@/lib/dates";

export default function MovementLogsPanel({
    branchId,
    movementLogs,
    filters,
}) {
    const perPage = Number(filters?.movement_log_per_page) || 15;

    const reloadLogs = (params) => {
        router.get(
            route("medicine-inventory.index"),
            {
                ...filters,
                movement_log_per_page: perPage,
                ...params,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["movementLogs", "filters"],
            },
        );
    };

    const goToPage = (page) => {
        reloadLogs({ movement_log_page: page });
    };

    const changePerPage = (value) => {
        reloadLogs({
            movement_log_per_page: value,
            movement_log_page: 1,
        });
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">Movement Logs</h2>
                        <p className="text-sm text-muted-foreground">
                            Audit trail for medicine changes and stock
                            movements.
                        </p>
                    </div>

                    {branchId && (
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor="movement_log_per_page"
                                className="text-sm text-muted-foreground"
                            >
                                Per page
                            </Label>
                            <select
                                id="movement_log_per_page"
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
                    )}
                </div>

                {!branchId && (
                    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                        Assign a branch to your account to view movement logs.
                    </div>
                )}

                {branchId && (
                    <>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Medicine</TableHead>
                                        <TableHead>Lot</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Remarks</TableHead>
                                        <TableHead className="text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movementLogs?.data?.length ? (
                                        movementLogs.data.map((log) => (
                                            <TableRow key={log.log_id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {formatDateTime(
                                                        log.created_at,
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {getMovementTypeLabel(
                                                        log.movement_type,
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {log.reference_label}
                                                </TableCell>
                                                <TableCell>
                                                    {log.medicine_name}
                                                </TableCell>
                                                <TableCell>
                                                    {log.lot_number || "—"}
                                                </TableCell>
                                                <TableCell
                                                    className={
                                                        log.quantity > 0
                                                            ? "text-green-700"
                                                            : log.quantity < 0
                                                              ? "text-red-700"
                                                              : ""
                                                    }
                                                >
                                                    {formatMovementQuantity(
                                                        log.quantity,
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {log.performer?.name ?? "—"}
                                                </TableCell>
                                                <TableCell className="max-w-[160px] truncate">
                                                    {log.remarks || "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <MovementLogViewModal
                                                        logId={log.log_id}
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
                                                    </MovementLogViewModal>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={9}
                                                className="py-10 text-center text-muted-foreground"
                                            >
                                                No movement logs recorded yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {movementLogs?.data?.length > 0 && (
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {movementLogs.from ?? 0} to{" "}
                                    {movementLogs.to ?? 0} of{" "}
                                    {movementLogs.total ?? 0} logs
                                </p>
                                {movementLogs.last_page > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                goToPage(
                                                    movementLogs.current_page -
                                                        1,
                                                )
                                            }
                                            disabled={
                                                movementLogs.current_page <= 1
                                            }
                                        >
                                            Previous
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Page {movementLogs.current_page} of{" "}
                                            {movementLogs.last_page}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                goToPage(
                                                    movementLogs.current_page +
                                                        1,
                                                )
                                            }
                                            disabled={
                                                movementLogs.current_page >=
                                                movementLogs.last_page
                                            }
                                        >
                                            Next
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
