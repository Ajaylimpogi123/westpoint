import { Button } from "@/components/ui/button";
import { Eye, Printer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import ViewModal from "./ViewModal";
import VoidReturnModal from "./VoidReturnModal";
import { formatDate } from "@/lib/dates";
import { formatPaymentMethod } from "../lib/historyHelpers";

function StatusBadge({ status }) {
    const normalized = status || "Completed";
    const styles = {
        Completed: "bg-green-100 text-green-700",
        "Partially Voided": "bg-amber-100 text-amber-700",
        Voided: "bg-red-100 text-red-700",
    };

    return (
        <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                styles[normalized] || "bg-muted text-muted-foreground"
            }`}
        >
            {normalized}
        </span>
    );
}

export const columns = [
    {
        accessorKey: "invoice_number",
        header: "Invoice Number",
    },
    {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => formatDate(row.getValue("created_at"), ""),
    },
    {
        accessorKey: "customer_name",
        header: "Customer",
        cell: ({ row }) => {
            const name = row.getValue("customer_name");
            return name && String(name).trim() !== "" ? name : "Walk-in";
        },
    },
    {
        accessorKey: "net_amount",
        cell: ({ row }) => (
            <>
                ₱
                {Number(row.getValue("net_amount")).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}
            </>
        ),
        header: "Total Amount",
    },
    {
        accessorKey: "payment_method",
        header: "Payment",
        cell: ({ row }) => formatPaymentMethod(row.getValue("payment_method")),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const sale = row.original;
            const isVoided = sale.status === "Voided";

            const handlePrintReceipt = () => {
                if (sale?.id) {
                    window.open(route("history.print", sale.id), "_blank");
                    toast.success("Printing receipt...");
                    return;
                }

                toast.error("Cannot print receipt: Sale ID not found");
            };

            return (
                <div className="flex items-center gap-2">
                    <ViewModal saleId={sale.id}>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="View sale details"
                        >
                            <Eye className="h-4 w-4" />
                        </Button>
                    </ViewModal>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePrintReceipt}
                        className="h-8 w-8 p-0"
                        title="Print this receipt"
                    >
                        <Printer className="h-4 w-4" />
                    </Button>
                    {!isVoided && (
                        <VoidReturnModal saleId={sale.id}>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                                title="Void or return items"
                            >
                                <Undo2 className="h-4 w-4" />
                            </Button>
                        </VoidReturnModal>
                    )}
                </div>
            );
        },
    },
];
