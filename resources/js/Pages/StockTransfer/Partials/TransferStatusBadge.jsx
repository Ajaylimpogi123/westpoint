import { STATUS_CONFIG } from "../lib/TransferHelpers";

/**
 * TransferStatusBadge
 * Props: status ('pending' | 'approved' | 'rejected' | 'cancelled')
 */
export default function TransferStatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}
