import { Bell } from "lucide-react";
import { Link, usePage } from "@inertiajs/react";

export function NotificationBell() {
    const { notifications } = usePage().props;
    const pendingCount = notifications?.pendingStockTransfers ?? 0;

    return (
        <Link
            href={route("stock-transfers.index")}
            className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label={`${pendingCount} pending stock transfer${pendingCount === 1 ? "" : "s"}`}
        >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {pendingCount > 99 ? "99+" : pendingCount}
                </span>
            )}
        </Link>
    );
}
