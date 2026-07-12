import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchQuotationMedicines } from "../lib/quotationMedicinesApi";

function formatProductLabel(product) {
    if (!product) return "";
    return product.label ?? product.med_name ?? "";
}

/**
 * Async medicine search for quotation item rows.
 * Dropdown is portaled to document.body so it is not clipped by table overflow.
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
    const debounceRef = useRef(null);

    const selectedLabel = useMemo(() => {
        if (typeof value === "string") return value;
        return formatProductLabel(value);
    }, [value]);

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
            const maxHeight = 224;
            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const spaceAbove = rect.top - 8;
            const openUpward =
                spaceBelow < maxHeight && spaceAbove > spaceBelow;

            setDropdownStyle({
                position: "fixed",
                left: rect.left,
                width: rect.width,
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
    }, [open, query, results.length, loading]);

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
                const data = await searchQuotationMedicines(trimmed);
                setResults(data.products ?? []);
                setHighlighted(0);
            } catch {
                setResults([]);
                setSearchError("Failed to search medicines.");
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

    function selectProduct(product) {
        onSelect(product);
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
            if (results[highlighted]) selectProduct(results[highlighted]);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    const hasSelection = Boolean(selectedLabel);

    const dropdown = open && dropdownStyle && (
        <ul
            ref={dropdownRef}
            style={dropdownStyle}
            className="overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
            {loading ? (
                <li className="px-3 py-2 text-slate-400">Searching...</li>
            ) : searchError ? (
                <li className="px-3 py-2 text-red-500">{searchError}</li>
            ) : query.trim().length < 1 ? (
                <li className="px-3 py-2 text-slate-400">
                    Type a medicine name or brand
                </li>
            ) : results.length === 0 ? (
                <li className="px-3 py-2 text-slate-400">No medicines found</li>
            ) : (
                results.map((product, i) => (
                    <li
                        key={product.id}
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
                ))
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
                    onKeyDown={handleKeyDown}
                    placeholder="Search medicine..."
                    disabled={disabled}
                    autoComplete="off"
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                        error ? "border-red-400" : "border-slate-300"
                    } ${hasSelection && !open ? "pr-8" : ""}`}
                />
                {hasSelection && !open && !disabled && onClear && (
                    <button
                        type="button"
                        onClick={() => {
                            onClear();
                            setQuery("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        ×
                    </button>
                )}
            </div>
            {dropdown && createPortal(dropdown, document.body)}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    );
}
