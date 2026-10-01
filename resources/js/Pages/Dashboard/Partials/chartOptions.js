export const CHART_COLORS = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
];

export function formatChartCurrency(value) {
    return `₱${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/**
 * Coerce series values to numbers. Decimal sums can arrive as strings, and a
 * string in the doughnut tooltip's reduce() concatenated instead of summing.
 */
export function toChartNumbers(values) {
    return (Array.isArray(values) ? values : []).map(
        (value) => Number(value) || 0,
    );
}

export const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: "#374151",
            },
        },
    },
};
