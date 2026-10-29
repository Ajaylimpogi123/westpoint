import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [
        laravel({
            input: "resources/js/app.jsx",
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "resources/js"),
        },
    },
    server: {
        watch: {
            // Vite watches the whole project by default. On this Windows/XAMPP
            // setup every watched file is slow to scan, so skip folders that
            // never hold frontend source.
            ignored: [
                "**/vendor/**",
                "**/storage/**",
                "**/tests/**",
                "**/database/**",
                "**/public/build/**",
                "**/.claude/**",
            ],
        },
        // Transform the first-load files as soon as the dev server starts,
        // instead of on the first browser request.
        warmup: {
            clientFiles: [
                "./resources/js/app.jsx",
                "./resources/js/Pages/Auth/Login.jsx",
                "./resources/js/Pages/Dashboard.jsx",
                "./resources/js/Pages/SuperadminDashboard.jsx",
                "./resources/js/Layouts/AuthenticatedLayout.jsx",
            ],
        },
    },
});
