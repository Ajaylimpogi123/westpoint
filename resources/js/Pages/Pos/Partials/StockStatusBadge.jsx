import {
    getMedicineStockStatus,
    getStockStatusBadgeClass,
} from "@/Pages/MedicineInventory/lib/stockStatus";

export default function StockStatusBadge({ totalStock, stockThreshold }) {
    const status = getMedicineStockStatus(totalStock, stockThreshold);

    return (
        <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStockStatusBadgeClass(status.tone)}`}
        >
            {status.label}
        </span>
    );
}
