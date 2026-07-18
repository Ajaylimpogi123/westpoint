import { format } from "date-fns";

/**
 * Parse API / form values into a local Date without timezone drift on YYYY-MM-DD.
 */
export function toDate(value) {
    if (value == null || value === "") {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const str = String(value).trim();
    const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Display format: dd/MM/yyyy */
export function formatDate(value, empty = "—") {
    const date = toDate(value);
    if (!date) {
        return empty;
    }

    return format(date, "dd/MM/yyyy");
}

/** Display format: dd/MM/yyyy, h:mm a */
export function formatDateTime(value, empty = "—") {
    const date = toDate(value);
    if (!date) {
        return empty;
    }

    return format(date, "dd/MM/yyyy, h:mm a");
}
