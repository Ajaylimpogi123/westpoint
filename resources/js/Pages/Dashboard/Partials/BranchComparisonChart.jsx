import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartDataKey, useChartJs } from "../Hooks/useChartJs";
import { baseChartOptions, formatChartCurrency, toChartNumbers } from "./chartOptions";

export default function BranchComparisonChart({
    labels = [],
    values: rawValues = [],
    subtitle = null,
}) {
    const values = toChartNumbers(rawValues);
    const hasData = values.some((value) => value > 0);

    const canvasRef = useChartJs(
        () => ({
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Total Revenue",
                        data: values,
                        backgroundColor: "rgba(59, 130, 246, 0.75)",
                        borderColor: "#3b82f6",
                        borderWidth: 1,
                        borderRadius: 6,
                    },
                ],
            },
            options: {
                ...baseChartOptions,
                plugins: {
                    ...baseChartOptions.plugins,
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) =>
                                formatChartCurrency(context.parsed.y),
                        },
                    },
                },
                scales: {
                    x: {
                        ticks: { color: "#6b7280" },
                        grid: { display: false },
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
            },
        }),
        chartDataKey(labels, values),
        hasData,
    );

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle>Branch Comparison</CardTitle>
                <CardDescription>
                    Net revenue side by side across all branches
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
                        No branch sales data available for these filters.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
