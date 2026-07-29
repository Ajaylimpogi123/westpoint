import { getExpiryStatus, formatDate } from "../lib/TransferHelpers";

/**
 * LotRow
 * Single selectable lot row inside LotPickerList.
 * Props: lot, isSelected, onSelect, isFirst (FEFO recommended)
 */
export default function LotRow({ lot, isSelected, onSelect, isFirst }) {
    const expStatus = getExpiryStatus(lot.expiry);
    const isExpired = !expStatus.canTransfer;
    const isLow = lot.quantity <= 20 && !isExpired;

    return (
        <div
            onClick={() => !isExpired && onSelect(lot)}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all
                ${
                    isExpired
                        ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200"
                        : isSelected
                          ? "border-blue-400 bg-blue-50 cursor-pointer"
                          : "border-gray-200 bg-white hover:border-blue-300 cursor-pointer"
                }`}
        >
            {/* Radio */}
            <input
                type="radio"
                name="lot-pick"
                checked={isSelected}
                disabled={isExpired}
                onChange={() => !isExpired && onSelect(lot)}
                className="accent-blue-600 flex-shrink-0"
            />

            {/* Lot info */}
            <div className="flex-1 min-w-0">
                <div
                    className={`text-sm font-semibold font-mono ${isExpired ? "text-gray-400" : "text-gray-800"}`}
                >
                    {lot.lot_number}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                    {lot.quantity} units available
                </div>
            </div>

            {/* Expiry */}
            <div className="text-right min-w-[80px]">
                <div className="text-xs font-medium text-gray-700">
                    {formatDate(lot.expiry)}
                </div>
                <div className={`text-[11px] mt-0.5 ${expStatus.color}`}>
                    {expStatus.label}
                </div>
            </div>

            {/* Status badge + FEFO indicator */}
            <div className="text-right min-w-[70px] flex flex-col items-end gap-1">
                <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${expStatus.bg} ${expStatus.color}`}
                >
                    {isExpired ? "Expired" : isLow ? "Low stock" : "Good"}
                </span>
                {isFirst && !isExpired && (
                    <span className="text-[10px] text-blue-500">
                        ★ FEFO pick
                    </span>
                )}
            </div>
        </div>
    );
}
