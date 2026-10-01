import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartDataKey, useChartJs } from "../Hooks/useChartJs";
import {
    baseChartOptions,
    CHART_COLORS,
    formatChartCurrency,
    toChartNumbers,
} from "./chartOptions";

export default function ProductBreakdownChart({
    labels = [],
    values: rawValues = [],
    subtitle = null,
}) {
    const values = toChartNumbers(rawValues);
    const hasData = values.some((value) => value > 0);

    const canvasRef = useChartJs(
        () => ({
            type: "doughnut",
            data: {
                labels,
                datasets: [
                    {
                        label: "Net Revenue",
                        data: values,
                        backgroundColor: labels.map(
                            (_, index) =>
                                CHART_COLORS[index % CHART_COLORS.length],
                        ),
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
                                    (sum, value) => sum + Number(value || 0),
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
        chartDataKey(labels, values),
        hasData,
    );

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle>Product Breakdown</CardTitle>
                <CardDescription>
                    Net revenue by medicine form
                    {subtitle ? ` · ${subtitle}` : ""}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <div className="h-[300px]">
                        <canvas ref={canvasRef} />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        No product sales found for the selected filters.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
