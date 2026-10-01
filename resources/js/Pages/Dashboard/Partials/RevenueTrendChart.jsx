import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartDataKey, useChartJs } from "../Hooks/useChartJs";
import { baseChartOptions, formatChartCurrency, toChartNumbers } from "./chartOptions";

const PERIOD_LABELS = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
};

/**
 * The trend is a fixed window (last 6 months) and intentionally ignores the
 * Stats Period filter; it still respects the branch and payment filters.
 */
export default function RevenueTrendChart({
    labels = [],
    values: rawValues = [],
    period = "monthly",
    paymentLabel = null,
}) {
    const values = toChartNumbers(rawValues);
    const hasData = values.some((value) => value > 0);
    const periodLabel = PERIOD_LABELS[period] ?? "Monthly";
    const windowLabel =
        period === "monthly" && labels.length > 0
            ? `last ${labels.length} month${labels.length === 1 ? "" : "s"}`
            : "over time";

    const canvasRef = useChartJs(
        () => ({
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Net Revenue",
                        data: values,
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16, 185, 129, 0.15)",
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                ],
            },
            options: {
                ...baseChartOptions,
                scales: {
                    x: {
                        ticks: { color: "#6b7280" },
                        grid: { color: "rgba(107, 114, 128, 0.15)" },
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#6b7280",
                            callback: (value) => formatChartCurrency(value),
                        },
                        grid: { color: "rgba(107, 114, 128, 0.15)" },
                    },
                },
                plugins: {
                    ...baseChartOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: (context) =>
                                `${context.dataset.label}: ${formatChartCurrency(context.parsed.y)}`,
                        },
                    },
                },
            },
        }),
        chartDataKey(labels, values),
        hasData,
    );

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>
                    {periodLabel} net revenue, {windowLabel}
                    {paymentLabel ? ` · ${paymentLabel}` : ""} (not affected
                    by Stats Period)
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <div className="h-[300px]">
                        <canvas ref={canvasRef} />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No revenue recorded in this window for the selected
                        filters.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
