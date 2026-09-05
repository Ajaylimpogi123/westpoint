export function toDisplayDate(isoDate) {
    if (!isoDate) return "";
    const datePart = isoDate.split("T")[0]; // safe if a timestamp ever slips in
    const [y, m, d] = datePart.split("-");
    if (!y || !m || !d) return "";
    return `${m}-${d}-${y}`;
}

export function toIsoDate(displayDate) {
    const [m, d, y] = displayDate.split("-");
    if (!m || !d || !y || y.length !== 4) return "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
