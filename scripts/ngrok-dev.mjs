// Starts `php artisan serve`, opens an ngrok tunnel to it, and prints the
// public URL once it's ready. Run with `npm run serve:ngrok`.
//
// Laravel's bootstrap/app.php trusts all proxies, so it correctly detects
// the HTTPS scheme/host from ngrok's X-Forwarded-* headers per request —
// no need to sync APP_URL to the (frequently changing) tunnel URL.
import { spawn } from "child_process";

const PORT = process.env.APP_PORT || 8000;

function run(cmd, args, opts = {}) {
    return spawn(cmd, args, { stdio: "inherit", shell: true, ...opts });
}

async function waitForNgrokUrl(retries = 30) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch("http://127.0.0.1:4040/api/tunnels");
            if (res.ok) {
                const data = await res.json();
                const tunnel = data.tunnels?.find((t) => t.proto === "https") ?? data.tunnels?.[0];
                if (tunnel?.public_url) return tunnel.public_url;
            }
        } catch {
            // ngrok's local API not up yet, keep polling.
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return null;
}

const laravel = run("php", ["artisan", "serve", `--port=${PORT}`]);
const ngrok = run("ngrok", ["http", String(PORT), "--log=stdout"]);

const url = await waitForNgrokUrl();
if (url) {
    console.log("\n============================================");
    console.log(` Public URL: ${url}`);
    console.log("============================================\n");
} else {
    console.log("\nCould not detect ngrok URL automatically. Check http://127.0.0.1:4040 for the tunnel status.\n");
}

function shutdown() {
    laravel.kill();
    ngrok.kill();
    process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
