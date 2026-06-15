import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Eye, MoreVertical, User } from "lucide-react";
import EditModal from "./EditModal";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Card({ children, users }) {
    const handleDelete = (id) => {
        if (confirm("Are you sure you want to delete this contact?")) {
            destroy(route("user.destroy", id), {
                preserveScroll: true,
                onSuccess: () => {
                    Alert("user deleted successfully.");
                },
            });
        }
    };

    return (
        <div className="rounded-sm bg-card text-card-foreground">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {users.map((user) => (
        <div
            key={user.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all"
        >
            <div className="flex flex-col h-full">
                {/* User Info Section */}
                <div className="flex items-center gap-4 mb-4">
                    {/* Avatar/Initials */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                    </div>

                    {/* User details */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                                {user.name}
                            </h3>
                            {user.email && (
                                <span className="text-sm text-gray-500 truncate">
                                    {user.email}
                                </span>
                            )}
                        </div>
                        
                        {/* Status Badge */}
                        <div className="mt-1.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.status === 'active' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                    user.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                                }`}></span>
                                {user.status || 'active'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons Section */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 mt-auto">
                    {/* View button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-indigo-600"
                    >
                        <Eye className="h-4 w-4" />
                    </Button>

                    {/* Edit button with modal */}
                    <EditModal user={user}>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-indigo-600"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </EditModal>

                    {/* Delete button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                        onClick={() => handleDelete(user.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>

                    {/* Dropdown menu for more actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 text-gray-500"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                                View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Change Status
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    ))}
</div>
{children && <div className="mt-4">{children}</div>}
        </div>
    );
}