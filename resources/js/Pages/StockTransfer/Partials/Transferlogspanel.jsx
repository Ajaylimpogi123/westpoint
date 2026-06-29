import { LOG_ACTION_CONFIG, formatDateTime } from "../lib/transferHelpers";

/**
 * TransferLogsPanel
 * Vertical timeline of all actions on a transfer.
 * Props: logs[]
 */
export default function TransferLogsPanel({ logs = [] }) {
    if (!logs.length) {
        return (
            <p className="text-xs text-gray-400 text-center py-4">
                No activity yet.
            </p>
        );
    }

    return (
        <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-3 top-3 bottom-3 w-px bg-gray-200" />

            {logs.map((log, idx) => {
                const cfg = LOG_ACTION_CONFIG[log.action] ?? {
                    label: log.action,
                    color: "bg-gray-400",
                };

                return (
                    <div
                        key={log.id ?? idx}
                        className="flex items-start gap-4 relative pb-5 last:pb-0"
                    >
                        {/* Dot */}
                        <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center
                            flex-shrink-0 z-10 ${cfg.color}`}
                        >
                            <span className="text-white text-[9px] font-bold">
                                {log.action === "created"
                                    ? "✎"
                                    : log.action === "approved"
                                      ? "✓"
                                      : log.action === "rejected"
                                        ? "✕"
                                        : log.action === "cancelled"
                                          ? "⊘"
                                          : log.action === "stock_moved"
                                            ? "↔"
                                            : "·"}
                            </span>
                        </div>

                        {/* Content */}
                        <div className="pt-0.5">
                            <div className="text-sm font-medium text-gray-800">
                                {cfg.label}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                                {log.performer?.name ?? "System"}
                                <span className="mx-1">·</span>
                                {formatDateTime(log.created_at)}
                            </div>
                            {log.note && (
                                <p className="text-xs text-gray-500 mt-1 italic">
                                    "{log.note}"
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
