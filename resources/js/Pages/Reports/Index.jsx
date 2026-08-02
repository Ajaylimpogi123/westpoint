import { Link } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import {
    TrendingUp,
    Package,
    ArrowLeftRight,
    BarChart3,
    Receipt,
    Award,
    UserCheck,
    Boxes,
    AlertTriangle,
    CalendarClock,
    PackagePlus,
    PackageMinus,
    ScrollText,
    ChevronRight,
} from "lucide-react";

const GROUPS = {
    Sales: {
        icon: TrendingUp,
        accent: "text-teal-700",
        chip: "bg-teal-50 text-teal-700",
        ring: "hover:ring-teal-200",
    },
    Inventory: {
        icon: Package,
        accent: "text-emerald-700",
        chip: "bg-emerald-50 text-emerald-700",
        ring: "hover:ring-emerald-200",
    },
    Movements: {
        icon: ArrowLeftRight,
        accent: "text-amber-700",
        chip: "bg-amber-50 text-amber-700",
        ring: "hover:ring-amber-200",
    },
};

const REPORTS = [
    {
        name: "Sales Summary",
        route: "reports.sales-summary",
        group: "Sales",
        icon: BarChart3,
        description: "Totals, payment method split, and daily trend.",
    },
    {
        name: "Sales Detail",
        route: "reports.sales-detail",
        group: "Sales",
        icon: Receipt,
        description: "Line-by-line transaction log with export.",
    },
    {
        name: "Top Products",
        route: "reports.top-products",
        group: "Sales",
        icon: Award,
        description: "Best sellers by units and revenue.",
    },
    {
        name: "Sales by Cashier",
        route: "reports.sales-by-cashier",
        group: "Sales",
        icon: UserCheck,
        description: "Performance breakdown per cashier.",
    },
    {
        name: "Stock on Hand",
        route: "reports.stock-on-hand",
        group: "Inventory",
        icon: Boxes,
        description: "Current quantity by product, lot, and branch.",
    },
    {
        name: "Low Stock",
        route: "reports.low-stock",
        group: "Inventory",
        icon: AlertTriangle,
        description: "Products at or below their reorder threshold.",
    },
    {
        name: "Expiry",
        route: "reports.expiry",
        group: "Inventory",
        icon: CalendarClock,
        description: "Batches expired or expiring soon.",
    },
    {
        name: "Stock In",
        route: "reports.stock-in",
        group: "Movements",
        icon: PackagePlus,
        description: "Deliveries received from suppliers.",
    },
    {
        name: "Stock Out",
        route: "reports.stock-out",
        group: "Movements",
        icon: PackageMinus,
        description: "Dispensed, sold, or issued stock.",
    },
    {
        name: "Stock Transfers",
        route: "reports.stock-transfers",
        group: "Movements",
        icon: ArrowLeftRight,
        description: "Inter-branch transfer requests and status.",
    },
    {
        name: "Movement Ledger",
        route: "reports.movement-ledger",
        group: "Movements",
        icon: ScrollText,
        description: "Full audit trail of every stock change.",
    },
];

export default function Index() {
    const groupNames = [...new Set(REPORTS.map((r) => r.group))];

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold">Reports</h2>}
        >
            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="mb-8 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-800 px-6 py-8 text-white shadow-sm">
                        {/* <p className="text-xs font-semibold uppercase tracking-wider text-teal-100">
                        Back office
                    </p> */}
                        <h1 className="mt-1 text-2xl font-semibold">Reports</h1>
                        <p className="mt-1 text-sm text-teal-50/90">
                            Sales, inventory, and stock movement across every
                            branch.
                        </p>
                    </div>

                    <div className="space-y-10">
                        {groupNames.map((groupName) => {
                            const group = GROUPS[groupName];
                            const GroupIcon = group.icon;

                            return (
                                <div key={groupName}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span
                                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${group.chip}`}
                                        >
                                            <GroupIcon className="w-4 h-4" />
                                        </span>
                                        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                                            {groupName}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {REPORTS.filter(
                                            (r) => r.group === groupName,
                                        ).map((r) => {
                                            const ReportIcon = r.icon;

                                            return (
                                                <Link
                                                    key={r.route}
                                                    href={route(r.route)}
                                                    className={`group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-transparent transition hover:shadow-md ${group.ring}`}
                                                >
                                                    <span
                                                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${group.chip} shrink-0`}
                                                    >
                                                        <ReportIcon className="w-4.5 h-4.5" />
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block font-medium text-slate-800">
                                                            {r.name}
                                                        </span>
                                                        <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
                                                            {r.description}
                                                        </span>
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1 transition group-hover:text-slate-400 group-hover:translate-x-0.5" />
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
