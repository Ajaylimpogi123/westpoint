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
// Labels
// ─────────────────────────────────────────────────────────

/** "Amoxicillin 500mg Capsule — Amoxil", skipping blank parts. */
export function describeProduct(product) {
    if (!product) return "—";
    const name = [product.med_name, product.dose, product.form]
        .filter(Boolean)
        .join(" ");
    return product.brand_name ? `${name} — ${product.brand_name}` : name;
}

/**
 * Transfer quantities are always pieces. Adds the box equivalent when the
 * pack size is known, e.g. "25 pcs (2 boxes + 5 pcs)".
 */
export function piecesLabel(pieces, packSize) {
    const qty = Number(pieces) || 0;
    const pack = Number(packSize) || 0;
    const base = `${qty} pcs`;

    if (pack <= 1 || qty < pack) return base;

    const boxes = Math.floor(qty / pack);
    const rest = qty % pack;
    const boxText = `${boxes} ${boxes === 1 ? "box" : "boxes"}`;

    return rest
        ? `${base} (${boxText} + ${rest} pcs)`
        : `${base} (${boxText})`;
}

/**
 * Who closed a request. Rejections and cancellations don't set approved_by,
 * so they come from the activity log instead.
 */
export function actionedBy(transfer) {
    if (transfer.status === "approved") {
        return transfer.approver?.name ?? null;
    }
    const log = (transfer.logs ?? []).find((l) => l.action === transfer.status);
    return log?.performer?.name ?? null;
}

// ─────────────────────────────────────────────────────────
// Expiry helpers (used by LotRow + LotPickerList)
// ─────────────────────────────────────────────────────────

// Whole calendar days from today (0 = expires today, still transferable,
// matching the server's notExpired scope).
export function getDaysUntilExpiry(expiry) {
    if (!expiry) return null;
    const [y, m, d] = String(expiry).slice(0, 10).split("-").map(Number);
    const expiryDay = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((expiryDay - today) / (1000 * 60 * 60 * 24));
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
    if (days === 0)
        return {
            label: "Expires today",
            color: "text-yellow-700",
            bg: "bg-yellow-50",
            canTransfer: true,
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
