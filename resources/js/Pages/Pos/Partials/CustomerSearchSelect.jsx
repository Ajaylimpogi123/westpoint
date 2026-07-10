import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchCustomers } from "../lib/posCustomerApi";
import { formatCustomerName } from "../lib/customerDiscount";

function CustomerTypeBadge({ type }) {
    const styles = {
        Regular: "bg-slate-100 text-slate-600",
        "Senior Citizen": "bg-blue-50 text-blue-700",
        PWD: "bg-purple-50 text-purple-700",
    };

    return (
        <span
            className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                styles[type] ?? styles.Regular,
            )}
        >
            {type}
        </span>
    );
}

export default function CustomerSearchSelect({
    value,
    onChange,
    onClear,
    showBranch = false,
    disabled = false,
    className,
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    const selectedLabel = useMemo(
        () => formatCustomerName(value),
        [value],
    );

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target)
            ) {
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
            setError("");

            return undefined;
        }

        setLoading(true);
        setError("");

        debounceRef.current = setTimeout(async () => {
            try {
                const data = await searchCustomers(trimmed);
                setResults(data.customers ?? []);
                setHighlighted(0);
            } catch {
                setResults([]);
                setError("Failed to search customers.");
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

    function handleKeyDown(event) {
        if (!open) {
            if (event.key === "ArrowDown" || event.key === "Enter") {
                setOpen(true);
                event.preventDefault();
            }

            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((index) =>
                Math.min(index + 1, Math.max(results.length - 1, 0)),
            );
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (results[highlighted]) {
                selectCustomer(results[highlighted]);
            }
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className={cn("relative min-w-0 flex-1", className)} ref={wrapperRef}>
            <div className="relative">
                <Input
                    type="text"
                    value={open ? query : selectedLabel}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => {
                        setOpen(true);
                        if (value) {
                            setQuery("");
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search by name or phone..."
                    autoComplete="off"
                    disabled={disabled}
                    className="pr-8"
                />
                {value && !open && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                            onClear?.();
                            setQuery("");
                        }}
                        disabled={disabled}
                    >
                        ×
                    </Button>
                )}
            </div>

            {open && (
                <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md">
                    {loading ? (
                        <li className="px-3 py-2 text-muted-foreground">
                            Searching...
                        </li>
                    ) : error ? (
                        <li className="px-3 py-2 text-destructive">{error}</li>
                    ) : query.trim().length < 1 ? (
                        <li className="px-3 py-2 text-muted-foreground">
                            Type a name or phone number
                        </li>
                    ) : results.length === 0 ? (
                        <li className="px-3 py-2 text-muted-foreground">
                            No customers found
                        </li>
                    ) : (
                        results.map((customer, index) => (
                            <li
                                key={customer.customer_id}
                                onMouseDown={() => selectCustomer(customer)}
                                onMouseEnter={() => setHighlighted(index)}
                                className={cn(
                                    "cursor-pointer px-3 py-2",
                                    index === highlighted && "bg-accent",
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {formatCustomerName(customer)}
                                    </span>
                                    <CustomerTypeBadge
                                        type={customer.customer_type}
                                    />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {[
                                        customer.phone_number,
                                        showBranch ? customer.branch_name : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
