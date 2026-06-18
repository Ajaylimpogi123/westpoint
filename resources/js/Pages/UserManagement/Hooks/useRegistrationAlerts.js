import { usePage } from "@inertiajs/react";
import { useEffect } from "react";
import Swal from "sweetalert2";

export function showRegistrationSuccess(message = "User registered successfully.") {
    return Swal.fire({
        icon: "success",
        title: "Registration Successful",
        text: message,
        confirmButtonColor: "#16a34a",
    });
}

export function showRegistrationError(errors, fallbackMessage) {
    const messages = Object.values(errors || {}).flat().filter(Boolean);
    const text =
        messages.length > 0
            ? messages.join("\n")
            : fallbackMessage || "Something went wrong. Please try again.";

    return Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text,
        confirmButtonColor: "#dc2626",
    });
}

export function showRegistrationWarning(message) {
    return Swal.fire({
        icon: "warning",
        title: "Notice",
        text: message,
        confirmButtonColor: "#ca8a04",
    });
}

export function useRegistrationAlerts() {
    const { flash } = usePage().props;

    useEffect(() => {
        if (flash?.success) {
            showRegistrationSuccess(flash.success);
        }

        if (flash?.error) {
            showRegistrationError({}, flash.error);
        }
    }, [flash?.success, flash?.error]);
}
