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
export const columns = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected?.()}
                onChange={(e) =>
                    table.toggleAllPageRowsSelected?.(e.target.checked)
                }
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected?.()}
                onChange={(e) => row.toggleSelected?.(e.target.checked)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "t_number",
        header: "Table Number",
    },
    {
        accessorKey: "t_description",
        header: "Table Description",
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const table = row.original;

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <div className="pl-2 pr-4 py-2 text-sm text-gray-800 hover:bg-gray-100 rounded-md cursor-pointer">
                            {" "}
                            <EditModal table={table}>Edit</EditModal>
                        </div>

                        <DropdownMenuItem className="pl-2 pr-4 py-2 text-sm text-gray-800 hover:bg-gray-100 rounded-md cursor-pointer">
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];
