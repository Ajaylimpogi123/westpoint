import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";

export default function CustomerSearchSelect({
    id,
    customers = [],
    value,
    onChange,
    placeholder = "Search customer...",
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const selectedCustomer = value
        ? (customers.find((c) => String(c.customer_id) === String(value)) ??
          null)
        : null;

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) {
            return customers;
        }

        return customers.filter((c) => {
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
            const type = (c.customer_type ?? "").toLowerCase();

            return fullName.includes(term) || type.includes(term);
        });
    }, [customers, search]);

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const openDropdown = () => {
        if (disabled) return;
        setOpen(true);
        setSearch("");
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const selectCustomer = (customerId) => {
        onChange(String(customerId));
        setOpen(false);
        setSearch("");
    };

    const clearSelection = (event) => {
        event.stopPropagation();
        onChange("");
        setSearch("");
    };

    return (
        <div ref={containerRef} className="relative">
            {open ? (
                <div className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm ring-1 ring-ring">
                    <input
                        ref={inputRef}
                        id={id}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setOpen(false);
                        }}
                        placeholder={placeholder}
                        className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
            ) : (
                <button
                    type="button"
                    id={id}
                    onClick={openDropdown}
                    disabled={disabled}
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <span
                        className={
                            selectedCustomer
                                ? "truncate text-foreground"
                                : "truncate text-muted-foreground"
                        }
                    >
                        {selectedCustomer
                            ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}${
                                  selectedCustomer.customer_type
                                      ? ` — ${selectedCustomer.customer_type}`
                                      : ""
                              }`
                            : placeholder}
                    </span>
                    <span className="flex items-center gap-1">
                        {selectedCustomer && (
                            <X
                                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                                onClick={clearSelection}
                            />
                        )}
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </span>
                </button>
            )}

            {open && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                    {filtered.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No customers match.
                        </p>
                    ) : (
                        filtered.map((c) => (
                            <button
                                type="button"
                                key={c.customer_id}
                                onClick={() => selectCustomer(c.customer_id)}
                                className={`flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                                    String(c.customer_id) === String(value)
                                        ? "bg-accent/50"
                                        : ""
                                }`}
                            >
                                <span className="font-medium">
                                    {c.first_name} {c.last_name}
                                </span>
                                {c.customer_type && (
                                    <span className="text-xs text-muted-foreground">
                                        {c.customer_type}
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
