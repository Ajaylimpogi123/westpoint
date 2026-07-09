export default function GenericBadge({ className = "" }) {
    return (
        <span
            className={`inline-flex rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 ${className}`}
        >
            Generic
        </span>
    );
}
