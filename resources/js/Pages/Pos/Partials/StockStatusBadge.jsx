import { getPosStockStatus, getStockStatusBadgeClass } from "../lib/pricing";

export default function StockStatusBadge({ totalStock, packSize }) {
    const status = getPosStockStatus(totalStock, packSize);

    return (
        <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStockStatusBadgeClass(status.tone)}`}
        >
            {status.label}
        </span>
    );
}
