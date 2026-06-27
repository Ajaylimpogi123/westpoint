import { Card, CardContent } from "@/Components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export default function MovementLogsPanel() {
    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <div>
                    <h2 className="text-lg font-semibold">Movement Logs</h2>
                    <p className="text-sm text-muted-foreground">
                        Audit trail for inventory movements will appear here.
                    </p>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Remarks</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    No movement logs recorded yet.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
