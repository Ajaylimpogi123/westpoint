import { STATUS_STYLES } from "../lib/quotationStatus";

export default function StatusBadge({ status }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset ${style}`}
        >
            {status}
        </span>
    );
}
