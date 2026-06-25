import { Button } from "@/components/ui/button";
import { Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import ViewModal from "./ViewModal";

export const columns = [
    {
        accessorKey: "invoice_number",
        header: "Invoice Number",
    },
    {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ row }) => {
            const dateString = row.getValue("created_at");
            if (!dateString) return "";
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "";
            return date.toLocaleDateString("en-PH", {
                year: "numeric",
                month: "short",
                day: "2-digit",
            });
        },
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
        cell: ({ row }) => {
            const method = row.getValue("payment_method");
            return method ? String(method).toUpperCase() : "";
        },
    },
    {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
            const sale = row.original;

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
                </div>
            );
        },
    },
];
