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

function formatPrice(value) {
    const price = Number(value);

    return value !== null && value !== undefined && value !== "" && Number.isFinite(price)
        ? `₱${price.toFixed(2)}`
        : "—";
}

/** Pieces across Active lots, when the product carries its batches. */
function availablePieces(product) {
    if (!Array.isArray(product?.batches)) {
        return null;
    }

    return product.batches
        .filter((lot) => (lot.status ?? "Active") === "Active" && !lot.is_expired)
        .reduce((sum, lot) => sum + (Number(lot.quantity) || 0), 0);
}

/** Extra result lines used when `detailed` is set (Stock Out). */
function DetailedResult({ product }) {
    const pieces = availablePieces(product);
    const packSize = Number(product.pack_size) >= 1 ? Number(product.pack_size) : null;

    return (
        <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
            <div>
                {[product.dose, product.form].filter(Boolean).join(" · ") || "No dose / form"}
                {" · "}
                {packSize ? `${packSize} pcs/box` : "No pack size"}
            </div>
            <div className="flex flex-wrap gap-x-3">
                <span>Retail {formatPrice(product.retail_price)}/pc</span>
                <span>Wholesale {formatPrice(product.wholesale_price)}/box</span>
                {pieces !== null && (
                    <span className={pieces > 0 ? "text-foreground" : "text-destructive"}>
                        {pieces > 0 ? `${pieces.toLocaleString()} pcs available` : "No stock"}
                    </span>
                )}
            </div>
        </div>
    );
}

export default function MedicineSearchSelect({
    id,
    products,
    value,
    onChange,
    placeholder = "Search medicine...",
    className,
    disabled = false,
    // Opt-in: show pack size, prices and available pieces in each result.
    // Off by default so other forms keep their compact list.
    detailed = false,
    invalid = false,
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
                disabled={disabled}
                value={open ? query : formatMedicineLabel(selected)}
                onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => {
                    if (disabled) {
                        return;
                    }

                    setOpen(true);
                    setQuery("");
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                aria-invalid={invalid || undefined}
                className={cn(invalid && "border-red-500 focus-visible:ring-red-500")}
            />
            {open && (
                <ul
                    className={cn(
                        "absolute z-50 mt-1 w-full overflow-auto rounded-md border border-input bg-popover py-1 text-sm shadow-md",
                        detailed ? "max-h-80" : "max-h-56",
                    )}
                >
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
                                {detailed ? (
                                    <DetailedResult product={product} />
                                ) : (product.dose || product.form) && (
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
