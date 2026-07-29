/**
 * Per-submission idempotency keys.
 *
 * A disabled submit button does not stop an Enter keypress inside a text
 * input, and it does nothing about a retried request, so duplicate stock
 * movements were possible whenever stock was plentiful enough that the
 * server-side sufficiency check did not catch the second write. The key is
 * generated when a form is opened and reused for every retry of that same
 * submission, letting the server recognise and collapse duplicates.
 */
export function newIdempotencyKey() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    const random = Math.random().toString(36).slice(2, 12);

    return `${Date.now().toString(36)}-${random}`;
}
