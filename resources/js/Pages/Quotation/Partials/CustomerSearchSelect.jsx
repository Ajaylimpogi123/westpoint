import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Searchable customer select with keyboard navigation (Up/Down/Enter/Escape).
 *
 * @param {Array}  customers - [{ cust_id, cust_name, address, tin }]
 * @param {number|string} value - currently selected cust_id
 * @param {(customer: object) => void} onChange
 * @param {string} error
 */
export default function CustomerSearchSelect({
    customers,
    value,
    onChange,
    error,
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const wrapperRef = useRef(null);

    const selected = useMemo(
        () => customers.find((c) => c.cust_id === value) ?? null,
        [customers, value],
    );

    const filtered = useMemo(() => {
        if (!query) return customers;
        const q = query.toLowerCase();
        return customers.filter((c) => c.cust_name.toLowerCase().includes(q));
    }, [customers, query]);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function selectCustomer(customer) {
        onChange(customer);
        setQuery("");
        setOpen(false);
    }

    function handleKeyDown(e) {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setOpen(true);
                e.preventDefault();
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[highlighted]) selectCustomer(filtered[highlighted]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={open ? query : (selected?.cust_name ?? "")}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlighted(0);
                    setOpen(true);
                }}
                onFocus={() => {
                    setOpen(true);
                    setQuery("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search customer..."
                className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                    error ? "border-red-400" : "border-slate-300"
                }`}
            />
            {open && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    {filtered.length === 0 && (
                        <li className="px-3 py-2 text-slate-400">
                            No customers found
                        </li>
                    )}
                    {filtered.map((c, i) => (
                        <li
                            key={c.cust_id}
                            onMouseDown={() => selectCustomer(c)}
                            onMouseEnter={() => setHighlighted(i)}
                            className={`cursor-pointer px-3 py-2 ${
                                i === highlighted
                                    ? "bg-indigo-50 text-indigo-700"
                                    : ""
                            }`}
                        >
                            <div className="font-medium">{c.cust_name}</div>
                            {c.address && (
                                <div className="text-xs text-slate-400">
                                    {c.address}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
