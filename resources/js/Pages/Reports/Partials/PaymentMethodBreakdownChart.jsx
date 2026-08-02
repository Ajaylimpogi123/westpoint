import { useChartJs } from "../../Dashboard/Hooks/useChartJs";
import {
    CHART_COLORS,
    formatChartCurrency,
} from "../../Dashboard/Partials/chartOptions";

export default function PaymentMethodBreakdownChart({ breakdown = [] }) {
    const labels = breakdown.map((row) => row.payment_method || "Unspecified");
    const values = breakdown.map((row) => Number(row.total));
    const hasData = values.some((value) => value > 0);

    const canvasRef = useChartJs(
        () => ({
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        label: "Net Sales",
                        data: values,
                        backgroundColor: labels.map(
                            (_, i) => CHART_COLORS[i % CHART_COLORS.length],
                        ),
                        borderWidth: 2,
                        borderColor: "#171B24",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: "#A6ADBE", padding: 16 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce(
                                    (sum, v) => sum + v,
                                    0,
                                );
                                const share =
                                    total > 0
                                        ? (
                                              (context.parsed / total) *
                                              100
                                          ).toFixed(1)
                                        : 0;
                                return `${context.label}: ${formatChartCurrency(context.parsed)} (${share}%)`;
                            },
                        },
                    },
                },
            },
        }),
        [labels.join(","), values.join(",")],
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl p-6">
            <h3 className="text-sm font-semibold text-white">
                Payment Method Breakdown
            </h3>
            <p className="mt-1 text-xs text-[#8C93A5]">
                Share of net sales by payment method for the selected period
            </p>
            {hasData ? (
                <div className="mt-4 h-[260px]">
                    <canvas ref={canvasRef} />
                </div>
            ) : (
                <p className="mt-4 text-sm text-[#8C93A5]">
                    No payment data available for this scope yet.
                </p>
            )}
        </div>
    );
}
