import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { searchQuotationMedicines } from "../lib/quotationMedicinesApi";

function formatProductLabel(product) {
    if (!product) return "";
    return product.label ?? product.med_name ?? "";
}

/**
 * Searchable medicine dropdown for quotation item rows.
 * Opens with the full A-Z list; typing narrows it down.
 * The list is portaled to document.body so table overflow can't clip it.
 */
export default function MedicineSearchSelect({
    value,
    onSelect,
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
    const [dropdownStyle, setDropdownStyle] = useState(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const requestId = useRef(0);

    const selectedLabel = useMemo(() => {
        if (typeof value === "string") return value;
        return formatProductLabel(value);
    }, [value]);

    const hasSelection = Boolean(selectedLabel);

    useEffect(() => {
        function handleClickOutside(e) {
            if (wrapperRef.current?.contains(e.target)) return;
            if (dropdownRef.current?.contains(e.target)) return;
            setOpen(false);
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!open) {
            setDropdownStyle(null);
            return undefined;
        }

        function updatePosition() {
            const input = inputRef.current;
            if (!input) return;

            const rect = input.getBoundingClientRect();
            const maxHeight = 260;
            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const spaceAbove = rect.top - 8;
            const openUpward =
                spaceBelow < maxHeight && spaceAbove > spaceBelow;

            setDropdownStyle({
                position: "fixed",
                left: rect.left,
                width: Math.max(rect.width, 320),
                top: openUpward ? undefined : rect.bottom + 4,
                bottom: openUpward
                    ? window.innerHeight - rect.top + 4
                    : undefined,
                maxHeight: Math.min(
                    maxHeight,
                    openUpward ? spaceAbove : spaceBelow,
                ),
                zIndex: 9999,
            });
        }

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, results.length, loading]);

    // Load the list whenever the dropdown is open. An empty query loads the
    // default A-Z list right away; typing is debounced.
    useEffect(() => {
        if (!open) return undefined;

        const trimmed = query.trim();
        const thisRequest = ++requestId.current;

        setLoading(true);
        setSearchError("");

        const timer = setTimeout(
            async () => {
                try {
                    const data = await searchQuotationMedicines(trimmed);
                    if (thisRequest !== requestId.current) return;
                    setResults(data.products ?? []);
                    setHighlighted(0);
                } catch {
                    if (thisRequest !== requestId.current) return;
                    setResults([]);
                    setSearchError("Failed to load medicines.");
                } finally {
                    if (thisRequest === requestId.current) setLoading(false);
                }
            },
            trimmed === "" ? 0 : 300,
        );

        return () => clearTimeout(timer);
    }, [open, query]);

    // Keep the highlighted row visible while using the arrow keys.
    useEffect(() => {
        if (!open || !dropdownRef.current) return;
        dropdownRef.current
            .querySelector(`[data-index="${highlighted}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [highlighted, open, results]);

    function selectProduct(product) {
        onSelect(product);
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
            setHighlighted((i) =>
                Math.min(i + 1, Math.max(results.length - 1, 0)),
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[highlighted]) selectProduct(results[highlighted]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    const dropdown = open && dropdownStyle && (
        <ul
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
            {loading && results.length === 0 ? (
                <li className="px-3 py-2 text-slate-400">Loading...</li>
            ) : searchError ? (
                <li className="px-3 py-2 text-red-500">{searchError}</li>
            ) : results.length === 0 ? (
                <li className="px-3 py-2 text-slate-400">No medicines found</li>
            ) : (
                <>
                    {results.map((product, i) => (
                        <li
                            key={product.id}
                            data-index={i}
                            onMouseDown={() => selectProduct(product)}
                            onMouseEnter={() => setHighlighted(i)}
                            className={`cursor-pointer px-3 py-2 ${
                                i === highlighted
                                    ? "bg-indigo-50 text-indigo-700"
                                    : ""
                            }`}
                        >
                            <div className="font-medium">
                                {formatProductLabel(product)}
                            </div>
                            {(product.dose || product.form) && (
                                <div className="text-xs text-slate-400">
                                    {[product.dose, product.form]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </div>
                            )}
                        </li>
                    ))}
                    {query.trim() === "" && results.length >= 30 && (
                        <li className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
                            Showing the first 30 — type to search for more
                        </li>
                    )}
                </>
            )}
        </ul>
    );

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={open ? query : selectedLabel}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        if (hasSelection) setQuery("");
                    }}
                    onClick={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        open && hasSelection
                            ? selectedLabel
                            : "Select or search medicine..."
                    }
                    disabled={disabled}
                    autoComplete="off"
                    className={`w-full rounded-lg border px-3 py-2 pr-14 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                        error ? "border-red-400" : "border-slate-300"
                    }`}
                />
                <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-slate-400">
                    {hasSelection && !open && !disabled && onClear && (
                        <button
                            type="button"
                            onClick={() => {
                                onClear();
                                setQuery("");
                            }}
                            className="pointer-events-auto hover:text-slate-600"
                            title="Clear"
                        >
                            ×
                        </button>
                    )}
                    <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                            open ? "rotate-180" : ""
                        }`}
                    />
                </div>
            </div>
            {dropdown && createPortal(dropdown, document.body)}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
