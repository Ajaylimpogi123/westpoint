import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";

// Set by scripts/ngrok-dev.mjs once the tunnel is up, so Vite's HMR
// websocket connects back through the ngrok URL instead of localhost.
const ngrokHost = process.env.NGROK_HOST;

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
        host: "0.0.0.0",
        port: 5173,
        strictPort: true,
        cors: true,
        // Allow requests coming through any ngrok tunnel hostname.
        allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io", ".ngrok.app"],
        ...(ngrokHost && {
            hmr: {
                host: ngrokHost,
                protocol: "wss",
                clientPort: 443,
            },
        }),
    },
});
