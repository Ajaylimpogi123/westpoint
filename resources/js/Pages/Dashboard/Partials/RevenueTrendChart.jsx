import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { useChartJs } from "../Hooks/useChartJs";
import { baseChartOptions, formatChartCurrency } from "./chartOptions";

export default function RevenueTrendChart({ labels = [], values = [], period = "monthly" }) {
    const hasData = values.some((value) => value > 0);

    const canvasRef = useChartJs(
        () => ({
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Revenue",
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
        [labels, values],
    );

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>
                    {period === "weekly" ? "Weekly" : "Monthly"} sales revenue over time
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <div className="h-[300px]">
                        <canvas ref={canvasRef} />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No revenue data available for this scope yet.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
