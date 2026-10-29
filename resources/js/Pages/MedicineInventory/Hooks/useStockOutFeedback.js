import { useState } from "react";
import { toast } from "sonner";
import {
    focusFirstError,
    generalErrors as collectGeneralErrors,
    orderedErrorKeys,
} from "../lib/stockOutValidation";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Validation + save feedback shared by the Stock Out create and edit forms.
 *
 * - Header checks are shown once the user has tried to save; basket-line
 *   checks are live, since a line's quantity is edited in place.
 * - Server validation errors (`errors.*`) win until the user edits that
 *   field; client checks override them for the same key.
 * - A refused save that comes back as flash.error is kept as a banner at the
 *   top of the form (the page-level alert hook also toasts it).
 */
export default function useStockOutFeedback({
    formRef,
    serverErrors = {},
    headerErrors = {},
    itemErrors = {},
    itemCount = 0,
}) {
    const [attempted, setAttempted] = useState(false);
    const [serverError, setServerError] = useState(null);

    const fieldErrors = {
        ...serverErrors,
        ...(attempted ? headerErrors : {}),
        ...itemErrors,
    };

    const problemCount = Object.values(fieldErrors).filter(Boolean).length;
    const generalErrors = collectGeneralErrors(fieldErrors, { itemCount });

    const scrollToTop = () => {
        window.requestAnimationFrame(() => {
            formRef.current
                ?.querySelector('[data-field="general-errors"]')
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    };

    const summarize = (errors, title) => {
        const keys = orderedErrorKeys(errors);

        toast.error(`${title} — ${plural(keys.length, "issue")} to fix`, {
            description: errors[keys[0]],
        });
    };

    /** Run client checks; returns true when the form may be posted. */
    const beforeSubmit = () => {
        setAttempted(true);
        setServerError(null);

        const problems = { ...headerErrors, ...itemErrors };

        if (Object.keys(problems).length === 0) {
            return true;
        }

        summarize(problems, "Can't save yet");
        // Wait a frame so the newly visible messages are in the DOM.
        window.requestAnimationFrame(() =>
            focusFirstError(formRef.current, problems),
        );

        return false;
    };

    /** onSuccess helper: true when the server refused with flash.error. */
    const handleServerFlash = (page) => {
        const message = page?.props?.flash?.error;

        if (!message) {
            return false;
        }

        setServerError(message);
        scrollToTop();

        return true;
    };

    /** onError: Inertia validation errors from the server. */
    const handleValidationErrors = (errors) => {
        if (!errors || Object.keys(errors).length === 0) {
            return;
        }

        summarize(errors, "Not saved");
        window.setTimeout(() => focusFirstError(formRef.current, errors), 50);
    };

    const resetFeedback = () => {
        setAttempted(false);
        setServerError(null);
    };

    return {
        attempted,
        fieldErrors,
        generalErrors,
        problemCount,
        serverError,
        dismissServerError: () => setServerError(null),
        beforeSubmit,
        handleServerFlash,
        handleValidationErrors,
        resetFeedback,
    };
}
