import * as React from "react";
import {
    ArrowUpCircleIcon,
    BarChartIcon,
    CameraIcon,
    ClipboardListIcon,
    DatabaseIcon,
    UserRound,
    FileCodeIcon,
    FileIcon,
    FileTextIcon,
    FolderIcon,
    HelpCircleIcon,
    LayoutDashboardIcon,
    ListIcon,
    SearchIcon,
    SettingsIcon,
    UsersIcon,
    UtensilsCrossed,
    TableIcon,
    Table,
    Database,
    LayoutGrid,
    ClipboardList,
    History,
    Pill,
    ShoppingCart,
} from "lucide-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePage } from "@inertiajs/react";

export function AppSidebar({ ...props }) {
    const { auth, app, flash } = usePage().props;

    const userData = {
        name: auth?.user?.name || "Guest",
        email: auth?.user?.email || "guest@example.com",
        avatar: auth?.user?.avatar || "/images/logo/Westpoint.png",
    };

    const roleId = auth?.user?.role_id;
    // console.log("roleId raw:", roleId, "| type:", typeof roleId);

    const defaultNavMain = [
        {
            title: "Dashboard",
            url: route("dashboard"),
            icon: LayoutDashboardIcon,
        },
        {
            title: "Medicine Inventory",
            url: route("medicine-inventory.index"),
            icon: Pill,
        },
        {
            title: "Point of Sale",
            url: route("pos.index"),
            icon: ShoppingCart,
        },
        {
            title: "Order History",
            url: route("history.index"),
            icon: History,
        },
        {
            title: "Stock Transfer",
            url: route("stock-transfers.index"),
            icon: ArrowUpCircleIcon,
        },
    ];

    //2 = Admin
    //3 = Superadmin

    const roleNavMain =
        roleId === 3
            ? [
                  {
                      title: "User Management",
                      url:
                          route("user-management.index") + "#user-registration",
                      icon: UserRound,
                  },
                  {
                      title: "Branch management",
                      url: route("branch-management.index"),
                      icon: LayoutDashboardIcon,
                  },
                  {
                      title: "Medicine Inventory",
                      url: route("medicine-inventory.index"),
                      icon: Pill,
                  },
                  {
                      title: "Point of Sale",
                      url: route("pos.index"),
                      icon: ShoppingCart,
                  },
                  {
                      title: "Order History",
                      url: route("history.index"),
                      icon: History,
                  },
                  {
                      title: "Stock Transfer",
                      url: route("stock-transfers.index"),
                      icon: ArrowUpCircleIcon,
                  },
              ]
            : roleId === 2
              ? [
                    {
                        title: "Dashboard",
                        url: route("dashboard"),
                        icon: LayoutDashboardIcon,
                    },
                    {
                        title: "Medicine Inventory",
                        url: route("medicine-inventory.index"),
                        icon: Pill,
                    },
                    {
                        title: "Point of Sale",
                        url: route("pos.index"),
                        icon: ShoppingCart,
                    },
                    {
                        title: "Order History",
                        url: route("history.index"),
                        icon: History,
                    },
                    {
                        title: "Stock Transfer",
                        url: route("stock-transfers.index"),
                        icon: ArrowUpCircleIcon,
                    },
                    {
                        title: "User Management",
                        url:
                            route("user-management.index") +
                            "#user-registration",
                        icon: UserRound,
                    },
                ]
              : defaultNavMain;

    const navItems = {
        user: userData,

        navMain: roleNavMain,
        navClouds: [
            {
                title: "Capture",
                icon: CameraIcon,
                isActive: true,
                url: "#",
                items: [
                    {
                        title: "Active Proposals",
                        url: "#",
                    },
                    {
                        title: "Archived",
                        url: "#",
                    },
                ],
            },
            {
                title: "Proposal",
                icon: FileTextIcon,
                url: "#",
                items: [
                    {
                        title: "Active Proposals",
                        url: "#",
                    },
                    {
                        title: "Archived",
                        url: "#",
                    },
                ],
            },
            {
                title: "Prompts",
                icon: FileCodeIcon,
                url: "#",
                items: [
                    {
                        title: "Active Proposals",
                        url: "#",
                    },
                    {
                        title: "Archived",
                        url: "#",
                    },
                ],
            },
        ],
        navSecondary: [
            {
                title: "Settings",
                url: "#",
                icon: SettingsIcon,
            },
            {
                title: "Get Help",
                url: "#",
                icon: HelpCircleIcon,
            },
            {
                title: "Search",
                url: "#",
                icon: SearchIcon,
            },
        ],
        documents: [1, 2, 3].includes(roleId)
            ? []
            : [
                  {
                      name: "Users",
                      url: route("user-management.index"),
                      icon: UserRound,
                  },
              ],
    };

    // Log the user data to verify it's working

    if (flash?.success) {
        console.log("Flash success:", flash.success);
    }
    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem className="flex justify-center">
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-2 object-center h-15 w-28 p-0"
                        >
                            <a href="#">
                                <img
                                    src="/images/logo/Westpoint.png"
                                    alt="Tiumai"
                                    className="object-contain"
                                />
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={navItems.navMain} />
                {navItems.documents.length > 0 && (
                    <NavDocuments items={navItems.documents} />
                )}
                {/* <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={navItems.user} />
            </SidebarFooter>
        </Sidebar>
    );
}
// console.log("data", navItems.user);
