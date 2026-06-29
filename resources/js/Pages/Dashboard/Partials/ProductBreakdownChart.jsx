import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/Components/ui/card";
import { useChartJs } from "../Hooks/useChartJs";
import { baseChartOptions, CHART_COLORS, formatChartCurrency } from "./chartOptions";

export default function ProductBreakdownChart({ labels = [], values = [] }) {
    const hasData = values.some((value) => value > 0);
    const backgroundColors = labels.map(
        (_, index) => CHART_COLORS[index % CHART_COLORS.length],
    );

    const canvasRef = useChartJs(
        () => ({
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        label: "Revenue",
                        data: values,
                        backgroundColor: backgroundColors,
                        borderWidth: 2,
                        borderColor: "#ffffff",
                    },
                ],
            },
            options: {
                ...baseChartOptions,
                plugins: {
                    ...baseChartOptions.plugins,
                    legend: {
                        position: "bottom",
                        labels: {
                            color: "#374151",
                            padding: 16,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce(
                                    (sum, value) => sum + value,
                                    0,
                                );
                                const share =
                                    total > 0
                                        ? ((context.parsed / total) * 100).toFixed(1)
                                        : 0;

                                return `${context.label}: ${formatChartCurrency(context.parsed)} (${share}%)`;
                            },
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
                <CardTitle>Product Breakdown</CardTitle>
                <CardDescription>
                    Sales distribution by medicine form
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <div className="h-[300px]">
                        <canvas ref={canvasRef} />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No product sales data available for this scope yet.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
