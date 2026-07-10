import { useEffect, useMemo, useRef, useState } from "react";
import { searchCustomers } from "@/Pages/Pos/lib/posCustomerApi";
import { formatCustomerName } from "../lib/customerName";

/**
 * Searchable customer select backed by tbl_customers (same API as POS).
 *
 * @param {object|null} value - selected customer object
 * @param {(customer: object) => void} onChange
 * @param {() => void} [onClear]
 * @param {string} [error]
 * @param {boolean} [disabled]
 */
export default function CustomerSearchSelect({
    value,
    onChange,
    onClear,
    error,
    disabled = false,
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchError, setSearchError] = useState("");
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    const selectedLabel = useMemo(() => formatCustomerName(value), [value]);

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

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const trimmed = query.trim();

        if (trimmed.length < 1) {
            setResults([]);
            setLoading(false);
            setSearchError("");
            return undefined;
        }

        setLoading(true);
        setSearchError("");

        debounceRef.current = setTimeout(async () => {
            try {
                const data = await searchCustomers(trimmed);
                setResults(data.customers ?? []);
                setHighlighted(0);
            } catch {
                setResults([]);
                setSearchError("Failed to search customers.");
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [open, query]);

    function selectCustomer(customer) {
        onChange(customer);
        setQuery("");
        setOpen(false);
        setResults([]);
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
            setHighlighted((i) =>
                Math.min(i + 1, Math.max(results.length - 1, 0)),
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[highlighted]) selectCustomer(results[highlighted]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={open ? query : selectedLabel}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        if (value) setQuery("");
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search by name or phone..."
                    disabled={disabled}
                    autoComplete="off"
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                        error ? "border-red-400" : "border-slate-300"
                    } ${value && !open ? "pr-8" : ""}`}
                />
                {value && !open && !disabled && (
                    <button
                        type="button"
                        onClick={() => {
                            onClear?.();
                            setQuery("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        ×
                    </button>
                )}
            </div>
            {open && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    {loading ? (
                        <li className="px-3 py-2 text-slate-400">
                            Searching...
                        </li>
                    ) : searchError ? (
                        <li className="px-3 py-2 text-red-500">
                            {searchError}
                        </li>
                    ) : query.trim().length < 1 ? (
                        <li className="px-3 py-2 text-slate-400">
                            Type a name or phone number
                        </li>
                    ) : results.length === 0 ? (
                        <li className="px-3 py-2 text-slate-400">
                            No customers found
                        </li>
                    ) : (
                        results.map((c, i) => (
                            <li
                                key={c.customer_id}
                                onMouseDown={() => selectCustomer(c)}
                                onMouseEnter={() => setHighlighted(i)}
                                className={`cursor-pointer px-3 py-2 ${
                                    i === highlighted
                                        ? "bg-indigo-50 text-indigo-700"
                                        : ""
                                }`}
                            >
                                <div className="font-medium">
                                    {formatCustomerName(c)}
                                </div>
                                {(c.phone_number || c.address) && (
                                    <div className="text-xs text-slate-400">
                                        {[c.phone_number, c.address]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </div>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            )}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
