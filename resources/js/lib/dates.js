import { format } from "date-fns";

/**
 * The pharmacy operates in Manila and the server runs in Asia/Manila, so
 * every datetime shown in the UI is Manila wall-clock time.
 *
 * Two shapes arrive from the server:
 *  - zone-less strings ("2026-10-29 14:05:00", "2026-10-29T14:05:00") from
 *    raw query-builder rows. These are already Manila wall-clock times and
 *    are taken at face value: no offset is added or subtracted.
 *  - strings carrying an offset ("...Z", "...+08:00") from Eloquent model
 *    serialization. These are real instants and are converted to Manila.
 */
export const APP_TIME_ZONE = "Asia/Manila";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// Zone-less date-time; space or "T" separator, optional seconds/fraction.
const WALL_CLOCK =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

function fromParts(year, month, day, hour = 0, minute = 0, second = 0) {
    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second || 0),
    );
}

/**
 * Parse API / form values into a Date without timezone drift.
 * Date-only and zone-less values become local Dates with the same fields;
 * values with an offset are parsed as the instant they describe.
 */
export function toDate(value) {
    if (value == null || value === "") {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const str = String(value).trim();

    const dateOnly = str.match(DATE_ONLY);
    if (dateOnly) {
        const [, year, month, day] = dateOnly;
        return fromParts(year, month, day);
    }

    const wallClock = str.match(WALL_CLOCK);
    if (wallClock) {
        const [, year, month, day, hour, minute, second] = wallClock;
        return fromParts(year, month, day, hour, minute, second);
    }

    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

let manilaFormatter = null;

function getManilaFormatter() {
    if (!manilaFormatter) {
        manilaFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: APP_TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
        });
    }

    return manilaFormatter;
}

/**
 * Parse a server value into a local Date whose fields equal the Manila
 * wall-clock time, ready for date-fns `format` or toLocale*String without
 * a `timeZone` option. Use this only for display.
 */
export function toManilaDate(value) {
    if (value == null || value === "") {
        return null;
    }

    if (typeof value === "string") {
        const str = value.trim();
        if (DATE_ONLY.test(str) || WALL_CLOCK.test(str)) {
            return toDate(str);
        }
    }

    const instant = toDate(value);
    if (!instant) {
        return null;
    }

    const parts = {};
    for (const part of getManilaFormatter().formatToParts(instant)) {
        parts[part.type] = part.value;
    }

    return fromParts(
        parts.year,
        parts.month,
        parts.day,
        parts.hour === "24" ? 0 : parts.hour,
        parts.minute,
        parts.second,
    );
}

/** Display format: MM-dd-yyyy */
export function formatDate(value, empty = "—") {
    const date = toManilaDate(value);
    if (!date) {
        return empty;
    }

    return format(date, "MM-dd-yyyy");
}

/** Display format: MM-dd-yyyy, h:mm a */
export function formatDateTime(value, empty = "—") {
    const date = toManilaDate(value);
    if (!date) {
        return empty;
    }

    return format(date, "MM-dd-yyyy, h:mm a");
}

/**
 * Locale-formatted Manila time, for screens that use toLocale*String
 * options (e.g. "October 29, 2026, 2:05 PM").
 */
export function formatLocaleDateTime(
    value,
    options,
    empty = "—",
    locale = undefined,
) {
    const date = toManilaDate(value);
    if (!date) {
        return empty;
    }

    return date.toLocaleString(locale, options);
}
