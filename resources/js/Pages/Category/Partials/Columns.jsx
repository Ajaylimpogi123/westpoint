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
        accessorKey: "cat_name",
        header: "Category Name",
    },
    {
        accessorKey: "cat_description",
        header: "Category Description",
    },
    {
        accessorKey: "cat_image",
        header: "Category Image",
        cell: ({ row }) => {
            const image = row.getValue("cat_image");

            return image ? (
                <img
                    src={`storage/${image}`}
                    alt={image}
                    className="h-15 w-12 object-cover"
                />
            ) : (
                <span>-</span>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const category = row.original;

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
                            <EditModal category={category}>Edit</EditModal>
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
