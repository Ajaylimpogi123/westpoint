import { AlertCircle, X } from "lucide-react";

const FIELD_LABELS = {
    idempotency_key: "Submission",
    items: "Basket",
};

function labelFor(key) {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];

    const line = key.match(/^items\.(\d+)\./);

    return line ? `Line ${Number(line[1]) + 1}` : null;
}

/**
 * Top-of-form messages: the server's flash.error for a refused save, and
 * any error that has no field of its own on screen. Anchored with
 * data-field="general-errors" so the form can scroll here.
 */
export default function StockOutFormAlerts({
    serverError,
    onDismissServerError,
    generalErrors = [],
    attempted = false,
    problemCount = 0,
}) {
    const showSummary = attempted && problemCount > 0 && !serverError;

    if (!serverError && generalErrors.length === 0 && !showSummary) {
        return <div data-field="general-errors" />;
    }

    return (
        <div data-field="general-errors" className="space-y-2" role="alert" aria-live="assertive">
            {serverError && (
                <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                        <p className="font-medium">Not saved</p>
                        <p>{serverError}</p>
                        <p className="mt-1 text-xs opacity-80">
                            Your entries are kept. Fix the problem and press Save again.
                        </p>
                    </div>
                    {onDismissServerError && (
                        <button
                            type="button"
                            onClick={onDismissServerError}
                            className="rounded p-0.5 opacity-70 hover:opacity-100"
                            aria-label="Dismiss"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )}

            {(generalErrors.length > 0 || showSummary) && (
                <div className="rounded-md border border-red-200 bg-red-50/70 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    {showSummary && (
                        <p className="flex items-center gap-2 font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {problemCount === 1
                                ? "1 thing needs fixing before this can be saved — see the highlighted field."
                                : `${problemCount} things need fixing before this can be saved — see the highlighted fields.`}
                        </p>
                    )}
                    {generalErrors.length > 0 && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-6">
                            {generalErrors.map(({ key, message }) => {
                                const label = labelFor(key);

                                return (
                                    <li key={key}>
                                        {label && !String(message).startsWith("Line ") ? `${label}: ` : ""}
                                        {message}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
