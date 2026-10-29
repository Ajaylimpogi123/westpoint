import { useEffect } from "react";
import axios from "axios";

/** At most one ping per this interval, and only while the user is active. */
const PING_EVERY_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "input", "wheel"];

/**
 * Keeps the server session alive while the user is working on a page that
 * makes no requests of its own (e.g. filling a long stock-out basket), so
 * Save does not fail with "Page Expired". A PC left idle still logs out
 * after SESSION_LIFETIME. If the session already ended, the first key press
 * or click reports it right away, before more is typed.
 */
export function useSessionKeepAlive() {
    useEffect(() => {
        let lastPing = Date.now();

        const onActivity = () => {
            const now = Date.now();

            if (now - lastPing < PING_EVERY_MS) {
                return;
            }

            lastPing = now;

            // An ended session is reported by the axios interceptor in bootstrap.js.
            axios.get(route("session.keep-alive")).catch(() => {});
        };

        ACTIVITY_EVENTS.forEach((name) =>
            window.addEventListener(name, onActivity, { capture: true, passive: true }),
        );

        return () =>
            ACTIVITY_EVENTS.forEach((name) =>
                window.removeEventListener(name, onActivity, { capture: true }),
            );
    }, []);
}
