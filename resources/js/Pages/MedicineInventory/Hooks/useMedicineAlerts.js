import { usePage } from "@inertiajs/react";
import { useEffect } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";

/**
 * A Radix dialog that is still open traps focus and closes on Escape, so a
 * SweetAlert opened on top of it can't be focused and dismissing it would
 * also close the form (losing the basket). While a dialog is open, show the
 * message as a toast instead; the form shows its own inline banner.
 */
function dialogIsOpen() {
    return Boolean(
        document.querySelector('[role="dialog"][data-state="open"]'),
    );
}

export function useMedicineAlerts() {
    const { flash } = usePage().props;

    useEffect(() => {
        const inDialog = (flash?.success || flash?.error) && dialogIsOpen();

        if (flash?.success) {
            if (inDialog) {
                toast.success(flash.success);
            } else {
                Swal.fire({
                    icon: "success",
                    title: "Success",
                    text: flash.success,
                    confirmButtonColor: "#16a34a",
                });
            }
        }

        if (flash?.error) {
            if (inDialog) {
                toast.error("Not saved", { description: flash.error });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: flash.error,
                    confirmButtonColor: "#dc2626",
                });
            }
        }
        // Keyed on the flash object, which is new on every response that
        // carries it, so retrying and hitting the same error shows it again.
    }, [flash]);
}
