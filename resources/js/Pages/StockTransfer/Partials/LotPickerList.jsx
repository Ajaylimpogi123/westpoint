import LotRow from "./LotRow";

/**
 * LotPickerList
 * Shows all lots for the selected product, sorted FEFO (earliest expiry first).
 * Props: lots[], selectedLot, onSelect
 */
export default function LotPickerList({ lots = [], selectedLot, onSelect }) {
    if (!lots.length) {
        return (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm gap-2">
                <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7"
                    />
                </svg>
                <span>No available lots for this item</span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide text-gray-400 font-medium">
                    Available lots — select one
                </span>
                <span className="text-xs text-gray-400">
                    ★ FEFO — earliest expiry first
                </span>
            </div>

            {lots.map((lot, idx) => (
                <LotRow
                    key={lot.id}
                    lot={lot}
                    isSelected={selectedLot?.id === lot.id}
                    onSelect={onSelect}
                    isFirst={idx === 0}
                />
            ))}
        </div>
    );
}
