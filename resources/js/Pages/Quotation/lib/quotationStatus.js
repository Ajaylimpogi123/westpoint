export const STATUS_STYLES = {
    draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
    sent: "bg-blue-50 text-blue-700 ring-blue-600/20",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    cancelled: "bg-red-50 text-red-700 ring-red-600/20",
};

// Which status button(s) to show, per current status — matches updateStatus()'s allowed values
export const STATUS_TRANSITIONS = {
    draft: [
        {
            status: "sent",
            label: "Mark as Sent",
            className: "bg-blue-600 hover:bg-blue-700 text-white",
        },
    ],
    sent: [
        {
            status: "approved",
            label: "Approve",
            className: "bg-emerald-600 hover:bg-emerald-700 text-white",
        },
        {
            status: "cancelled",
            label: "Cancel",
            className: "border border-red-200 text-red-600 hover:bg-red-50",
        },
    ],
};

export const STATUS_CONFIRMATIONS = {
    sent: "Mark this quotation as sent?",
    approved: "Approve this quotation?",
    cancelled: "Cancel this quotation? This cannot be undone.",
};

export function formatCurrency(n) {
    return (parseFloat(n) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
