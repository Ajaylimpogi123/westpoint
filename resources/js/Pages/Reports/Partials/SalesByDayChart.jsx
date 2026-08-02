import { useChartJs } from "../../Dashboard/Hooks/useChartJs";
import { formatChartCurrency } from "../../Dashboard/Partials/chartOptions";

export default function SalesByDayChart({ byDay = [] }) {
    const labels = byDay.map((row) => row.sale_date);
    const values = byDay.map((row) => Number(row.net_amount));
    const hasData = values.some((value) => value > 0);

    const canvasRef = useChartJs(
        () => ({
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Net Sales",
                        data: values,
                        borderColor: "#4F9CF9",
                        backgroundColor: "rgba(79, 156, 249, 0.15)",
                        fill: true,
                        tension: 0.35,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: "#8C93A5" },
                        grid: { color: "rgba(255,255,255,0.06)" },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#8C93A5",
                            callback: (value) => formatChartCurrency(value),
                        },
                        grid: { color: "rgba(255,255,255,0.06)" },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) =>
                                `Net: ${formatChartCurrency(context.parsed.y)}`,
                        },
                    },
                },
            },
        }),
        [labels.join(","), values.join(",")],
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-6">
            <h3 className="text-sm font-semibold text-white">Sales by Day</h3>
            <p className="mt-1 text-xs text-[#8C93A5]">
                Net sales trend across the selected period
            </p>
            {hasData ? (
                <div className="mt-4 h-[260px]">
                    <canvas ref={canvasRef} />
                </div>
            ) : (
                <p className="mt-4 text-sm text-[#8C93A5]">
                    No sales data available for this scope yet.
                </p>
            )}
        </div>
    );
}
