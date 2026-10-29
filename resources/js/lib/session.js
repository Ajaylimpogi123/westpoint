import Swal from "sweetalert2";

let notified = false;

/**
 * Tells the user their login session ended (idle timeout or browser
 * restart) and sends them to the login page, instead of Laravel's bare
 * "Page Expired" screen. Shown once, however many requests fail.
 */
export function notifySessionExpired() {
    if (notified) {
        return;
    }

    notified = true;

    Swal.fire({
        icon: "warning",
        title: "Session expired",
        text: "You were logged out after a period of inactivity, so this could not be saved. Please log in again.",
        confirmButtonText: "Log in again",
        allowOutsideClick: false,
        allowEscapeKey: false,
    }).then(() => {
        window.location.href = route("login");
    });
}

/** True for responses that mean the session is gone (401 unauthenticated, 419 CSRF/session expired). */
export function isSessionExpiredStatus(status) {
    return status === 401 || status === 419;
}
