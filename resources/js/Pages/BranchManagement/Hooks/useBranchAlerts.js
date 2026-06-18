import { usePage } from "@inertiajs/react";
import { useEffect } from "react";
import Swal from "sweetalert2";

export function useBranchAlerts() {
    const { flash } = usePage().props;

    useEffect(() => {
        if (flash?.success) {
            Swal.fire({
                icon: "success",
                title: "Success",
                text: flash.success,
                confirmButtonColor: "#16a34a",
            });
        }

        if (flash?.error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: flash.error,
                confirmButtonColor: "#dc2626",
            });
        }
    }, [flash?.success, flash?.error]);
}
