import Checkbox from "@/Components/Checkbox";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import EditModal from "./EditModal";
import { Printer } from "lucide-react";
import { toast } from "sonner";
export const columns = [

    {
        accessorKey: "invoice_no",
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
        accessorKey: "table_number",
        header: "Table Number",
    },
    {
        accessorKey: "cust_fullname",
        header: "Customer",
    },
    {
        accessorKey: "od_total_amt_due",
        cell: ({ row }) => (
            <>
                ₱
                {Number(row.getValue("od_total_amt_due")).toLocaleString("en-PH", {
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
    },
    {
        id: "Print",
        header: "Print",
        cell: ({ row }) => {
            const order = row.original;

            const handlePrintReceipt = () => {
                if (order && order.od_id) {
                    // Open print window similar to CartSummary
                    window.open(route('order.print', order.od_id), '_blank');
                    toast.success("Printing receipt...");
                } else if (order && order.invoice_no) {
                    // If od_id is not available, try using invoice_no or order_id
                    const orderId = order.od_id || order.id || order.order_id;
                    if (orderId) {
                        window.open(route('order.print', orderId), '_blank');
                        toast.success("Printing receipt...");
                    } else {
                        toast.error("Cannot print receipt: Order ID not found");
                    }
                } else {
                    toast.error("No order data to print");
                }
            };


            return (
              <div className="flex items-center gap-2">
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
