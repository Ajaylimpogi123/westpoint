import "../css/app.css";
import "./bootstrap";

import { createInertiaApp, router } from "@inertiajs/react";
import { resolvePageComponent } from "laravel-vite-plugin/inertia-helpers";
import { createRoot } from "react-dom/client";
import { isSessionExpiredStatus, notifySessionExpired } from "@/lib/session";

const appName = import.meta.env.VITE_APP_NAME || "Laravel";

// A form submitted after the session ended gets a 419 ("Page Expired") or
// 401 page back. Explain it and send the user to log in, instead of showing
// Laravel's bare error page in a modal.
router.on("invalid", (event) => {
    if (isSessionExpiredStatus(event.detail.response?.status)) {
        event.preventDefault();
        notifySessionExpired();
    }
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob("./Pages/**/*.jsx"),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: "#4B5563",
    },
});
