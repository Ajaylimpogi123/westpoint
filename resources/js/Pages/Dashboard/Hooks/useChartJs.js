import { useEffect, useRef } from "react";

/**
 * Creates a Chart.js instance on the returned canvas ref.
 *
 * `dataKey` should change only when the chart's data actually changes.
 * Inertia hands us fresh array instances on every visit (and parents often
 * default with `?? []`), so keying on array identity re-created the chart on
 * renders where nothing changed. Callers pass a content key instead.
 *
 * `enabled` lets callers skip creation while the canvas is not mounted
 * (e.g. an empty state is shown instead) and re-create once it mounts.
 */
export function useChartJs(buildConfig, dataKey, enabled = true) {
    const canvasRef = useRef(null);
    const buildConfigRef = useRef(buildConfig);

    buildConfigRef.current = buildConfig;

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!enabled || !canvas || typeof window.Chart === "undefined") {
            return undefined;
        }

        const chart = new window.Chart(canvas, buildConfigRef.current());

        return () => {
            chart.destroy();
        };
    }, [dataKey, enabled]);

    return canvasRef;
}

/** Stable content key for chart series. */
export function chartDataKey(...series) {
    return JSON.stringify(series);
}
