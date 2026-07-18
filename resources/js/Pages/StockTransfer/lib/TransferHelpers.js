// ─────────────────────────────────────────────────────────
// Status & Priority config (used by badges, cards, rows)
// ─────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
    pending: {
        label: "Pending",
        color: "text-yellow-700",
        bg: "bg-yellow-50",
        border: "border-yellow-300",
        dot: "bg-yellow-400",
    },
    approved: {
        label: "Approved",
        color: "text-green-700",
        bg: "bg-green-50",
        border: "border-green-300",
        dot: "bg-green-500",
    },
    rejected: {
        label: "Rejected",
        color: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-300",
        dot: "bg-red-500",
    },
    cancelled: {
        label: "Cancelled",
        color: "text-gray-500",
        bg: "bg-gray-100",
        border: "border-gray-300",
        dot: "bg-gray-400",
    },
};

export const PRIORITY_CONFIG = {
    normal: { label: "Normal", color: "text-blue-700", bg: "bg-blue-50" },
    urgent: { label: "Urgent", color: "text-red-700", bg: "bg-red-50" },
    routine: { label: "Routine", color: "text-gray-600", bg: "bg-gray-100" },
};

export const LOG_ACTION_CONFIG = {
    created: { label: "Request created", color: "bg-blue-500" },
    approved: { label: "Approved", color: "bg-green-500" },
    rejected: { label: "Rejected", color: "bg-red-500" },
    cancelled: { label: "Cancelled", color: "bg-gray-400" },
    stock_moved: { label: "Stock moved", color: "bg-purple-500" },
};

export { formatDate, formatDateTime } from "@/lib/dates";

// ─────────────────────────────────────────────────────────
// Expiry helpers (used by LotRow + LotPickerList)
// ─────────────────────────────────────────────────────────

export function getDaysUntilExpiry(expiry) {
    if (!expiry) return null;
    const diff = new Date(expiry) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(expiry) {
    const days = getDaysUntilExpiry(expiry);
    if (days === null)
        return {
            label: "No expiry",
            color: "text-gray-500",
            bg: "bg-gray-100",
            canTransfer: true,
        };
    if (days < 0)
        return {
            label: "Expired",
            color: "text-red-700",
            bg: "bg-red-50",
            canTransfer: false,
        };
    if (days <= 30)
        return {
            label: `${days}d left`,
            color: "text-yellow-700",
            bg: "bg-yellow-50",
            canTransfer: true,
        };
    return {
        label: `${days}d left`,
        color: "text-green-700",
        bg: "bg-green-50",
        canTransfer: true,
    };
}

// ─────────────────────────────────────────────────────────
// Pipeline step helper (used by PipelineBar)
// ─────────────────────────────────────────────────────────

export function getPipelineStep(status) {
    // Returns how many steps are "done" (0-4)
    return { pending: 1, approved: 4, rejected: 2, cancelled: 2 }[status] ?? 0;
}
