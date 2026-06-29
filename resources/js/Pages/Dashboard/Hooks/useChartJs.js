import { useEffect, useRef } from "react";

export function useChartJs(buildConfig, dependencies = []) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas || typeof window.Chart === "undefined") {
            return undefined;
        }

        chartRef.current?.destroy();

        chartRef.current = new window.Chart(canvas, buildConfig());

        return () => {
            chartRef.current?.destroy();
            chartRef.current = null;
        };
    }, dependencies);

    return canvasRef;
}
