import { getStockStatusBadgeClass } from "../lib/stockStatus";

export default function StockStatusBadge({ status }) {
    if (!status?.label) return null;

    return (
        <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStockStatusBadgeClass(status.tone)}`}
        >
            {status.label}
        </span>
    );
}
