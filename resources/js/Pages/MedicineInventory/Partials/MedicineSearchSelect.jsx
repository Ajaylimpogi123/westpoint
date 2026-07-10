import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatMedicineLabel(product) {
    if (!product) {
        return "";
    }

    const brand = product.brand_name ? ` (${product.brand_name})` : "";
    return `${product.med_name ?? ""}${brand}`;
}

function matchesQuery(product, query) {
    const haystack = [
        product.med_name,
        product.brand_name,
        product.dose,
        product.form,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return haystack.includes(query);
}

export default function MedicineSearchSelect({
    id,
    products,
    value,
    onChange,
    placeholder = "Search medicine...",
    className,
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);
    const wrapperRef = useRef(null);

    const selected = useMemo(
        () => products.find((product) => String(product.id) === String(value)) ?? null,
        [products, value],
    );

    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            return products;
        }

        return products.filter((product) =>
            matchesQuery(product, normalizedQuery),
        );
    }, [products, query]);

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
        setHighlighted(0);
    }, [query]);

    function selectProduct(product) {
        onChange(String(product.id));
        setQuery("");
        setOpen(false);
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
                Math.min(index + 1, filtered.length - 1),
            );
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (filtered[highlighted]) {
                selectProduct(filtered[highlighted]);
            }
        } else if (event.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className={cn("relative", className)} ref={wrapperRef}>
            <Input
                id={id}
                type="text"
                value={open ? query : formatMedicineLabel(selected)}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    setOpen(true);
                    setQuery("");
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete="off"
            />
            {open && (
                <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md">
                    {filtered.length === 0 ? (
                        <li className="px-3 py-2 text-muted-foreground">
                            No medicines found
                        </li>
                    ) : (
                        filtered.map((product, index) => (
                            <li
                                key={product.id}
                                onMouseDown={() => selectProduct(product)}
                                onMouseEnter={() => setHighlighted(index)}
                                className={cn(
                                    "cursor-pointer px-3 py-2",
                                    index === highlighted && "bg-accent",
                                )}
                            >
                                <div className="font-medium">
                                    {formatMedicineLabel(product)}
                                </div>
                                {(product.dose || product.form) && (
                                    <div className="text-xs text-muted-foreground">
                                        {[product.dose, product.form]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </div>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
