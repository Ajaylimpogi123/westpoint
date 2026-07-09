import { CUSTOMER_TYPE_STYLES } from "../lib/customerType";

export default function CustomerTypeBadge({ type }) {
    const style = CUSTOMER_TYPE_STYLES[type] ?? CUSTOMER_TYPE_STYLES.Regular;

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
        >
            {type}
        </span>
    );
}
