import { useMemo } from "react";
import { Head, Link } from "@inertiajs/react";

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
}

function formatCurrency(amount) {
    return `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function receiptNumber(stockOutId) {
    return String(stockOutId ?? "").padStart(6, "0");
}

function unitLabel(unitType) {
    return unitType === "box" ? "Box" : "Piece";
}

/**
 * StockOutReceipt
 * Standalone printable delivery receipt — no AuthenticatedLayout so the nav
 * doesn't appear on print. Accessed via GET /stock-out/{id}/receipt
 *
 * Styled after a classic ledger-style delivery receipt, with Westpoint's
 * own company details in the letterhead (this document is issued by
 * Westpoint when stock leaves branch inventory).
 *
 * Props: stockOut (with branch, items.product)
 */
export default function StockOutReceipt({ stockOut }) {
    const items = stockOut.items ?? [];

    const priceFor = (item) => {
        if (!item?.product) return 0;
        const value =
            item.unit_type === "box"
                ? item.product.wholesale_price
                : item.product.retail_price;
        return Number(value || 0);
    };

    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => {
            const unitPrice = priceFor(item);
            return sum + unitPrice * Number(item.quantity_deducted || 0);
        }, 0);
    }, [items]);

    return (
        <>
            <Head title={`Delivery Receipt — #${receiptNumber(stockOut.stock_out_id)}`} />

            {/* ── Print styles ─────────────────────────────────── */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body      { background: white !important; -webkit-print-color-adjust: exact; }
                    @page     { margin: 1.2cm; size: A4 portrait; }
                    .slip-card { box-shadow: none !important; border: none !important; }
                }
                @media screen {
                    body { background: #f3f4f6; }
                }
            `}</style>

            {/* ── Toolbar (hidden on print) ─────────────────────── */}
            <div
                className="no-print flex items-center justify-between px-6 py-3
                bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm"
            >
                <Link
                    href={route("medicine-inventory.index")}
                    className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition"
                >
                    ← Back to inventory
                </Link>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400 font-mono">
                        #{receiptNumber(stockOut.stock_out_id)}
                    </span>
                    <button
                        onClick={() => window.print()}
                        className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white
                            hover:bg-blue-700 transition font-medium flex items-center gap-2"
                    >
                        <PrintIcon /> Print receipt
                    </button>
                </div>
            </div>

            {/* ── Receipt body ─────────────────────────────────── */}
            <div className="min-h-screen py-8 px-4 flex justify-center">
                <div
                    className="slip-card w-full max-w-3xl bg-white
                    shadow-lg border border-gray-300 overflow-hidden font-serif"
                >
                    <div className="px-8 pt-6 pb-8">
                        {/* ── LETTERHEAD ──────────────────────────── */}
                        <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-3 mb-4">
                            <img
                                src="/storage/westpoint_logo.png"
                                alt="Westpoint Pharma and Medical Supplies Distribution"
                                className="h-20 w-20 shrink-0 object-contain"
                            />
                            <div className="flex-1">
                                <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">
                                    Westpoint Pharma and Medical Supplies
                                    Distribution
                                </h1>
                                <p className="text-[11px] text-gray-600 mt-1">
                                    TIN: 439-169-208-00000
                                </p>
                                <p className="text-[11px] text-gray-600">
                                    Address: 6th Lacson St., Bacolod City,
                                    Negros Occidental, 6100
                                </p>
                                <p className="text-[11px] text-gray-600">
                                    Bulk/Wholesale Quotations: (034) 479
                                    2739 / (0992) 989 5971
                                </p>
                                <p className="text-[11px] text-gray-600">
                                    Retail pricing: (034) 454 1118 / (0917)
                                    162 8332
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start justify-between mb-4">
                            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">
                                Delivery Receipt
                            </h2>
                            <p className="text-sm text-red-600 font-semibold whitespace-nowrap">
                                No.{" "}
                                <span className="font-mono">
                                    {receiptNumber(stockOut.stock_out_id)}
                                </span>
                            </p>
                        </div>

                        {/* ── HEADER FIELDS ───────────────────────── */}
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-5">
                            <FieldLine
                                label="Delivered to"
                                value={stockOut.delivered_to}
                            />
                            <FieldLine
                                label="Date"
                                value={formatDate(stockOut.created_at)}
                            />
                            <FieldLine
                                label="Address"
                                value={stockOut.delivered_to_address}
                            />
                            <FieldLine
                                label="Transaction type"
                                value={stockOut.transaction_subtype}
                            />
                            <FieldLine
                                label="From"
                                value={stockOut.branch?.branch_name}
                            />
                            <FieldLine
                                label="Patient / Reference"
                                value={stockOut.patient_reference}
                            />
                            <FieldLine
                                label="Issued by"
                                value={stockOut.issued_by}
                            />
                        </div>

                        {/* Remarks */}
                        {stockOut.remarks && (
                            <div className="border border-gray-300 px-3 py-2 mb-5 text-sm">
                                <span className="text-gray-500">
                                    Remarks:{" "}
                                </span>
                                <span className="text-gray-800">
                                    {stockOut.remarks}
                                </span>
                            </div>
                        )}

                        {/* ── ITEMS TABLE ──────────────────────────── */}
                        <table className="w-full text-sm border-collapse border border-gray-800">
                            <thead>
                                <tr>
                                    <Th className="w-10">No.</Th>
                                    <Th align="left">Description</Th>
                                    <Th>Batch No.</Th>
                                    <Th>Expiry Date</Th>
                                    <Th>Unit</Th>
                                    <Th align="right">Qty.</Th>
                                    <Th align="right">Unit Price</Th>
                                    <Th align="right">Amount</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const qty = Number(
                                        item.quantity_deducted || 0,
                                    );
                                    const unitPrice = priceFor(item);
                                    const amount = unitPrice * qty;

                                    return (
                                        <tr key={item.item_id ?? idx}>
                                            <Td align="center">{idx + 1}</Td>
                                            <Td align="left">
                                                <span className="font-semibold text-gray-800">
                                                    {item.product?.med_name ??
                                                        "—"}
                                                </span>
                                                <span className="block text-xs text-gray-500">
                                                    {item.product?.dose ?? "—"}
                                                    {item.product?.form
                                                        ? ` / ${item.product.form}`
                                                        : ""}
                                                    {item.product?.brand_name
                                                        ? ` — ${item.product.brand_name}`
                                                        : ""}
                                                </span>
                                            </Td>
                                            <Td align="center" mono>
                                                {item.lot_number ?? "—"}
                                            </Td>
                                            <Td align="center">
                                                {formatDate(item.expiry)}
                                            </Td>
                                            <Td align="center">
                                                {unitLabel(item.unit_type)}
                                            </Td>
                                            <Td align="right">
                                                <span className="font-bold">
                                                    {qty}
                                                </span>
                                            </Td>
                                            <Td align="right">
                                                {formatCurrency(unitPrice)}
                                            </Td>
                                            <Td align="right">
                                                {formatCurrency(amount)}
                                            </Td>
                                        </tr>
                                    );
                                })}

                                {/* Blank filler rows for a consistent printed block, like a pre-printed pad */}
                                {Array.from({
                                    length: Math.max(0, 4 - items.length),
                                }).map((_, i) => (
                                    <tr key={`blank-${i}`}>
                                        <Td>&nbsp;</Td>
                                        <Td />
                                        <Td />
                                        <Td />
                                        <Td />
                                        <Td />
                                        <Td />
                                        <Td />
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="border border-gray-800 px-3 py-2 text-xs font-semibold
                                            text-gray-700 uppercase tracking-wide text-right"
                                    >
                                        Total Amount Due
                                    </td>
                                    <td className="border border-gray-800 px-3 py-2 text-right font-bold text-gray-900 text-base">
                                        {formatCurrency(totalAmount)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* ── SIGNATURES ──────────────────────────── */}
                        <div className="grid grid-cols-3 gap-6 mt-8">
                            <SignatureBox
                                label="Prepared / Issued by"
                                name={stockOut.issued_by}
                                sublabel={stockOut.branch?.branch_name}
                            />
                            <SignatureBox
                                label="Approved by"
                                blank
                            />
                            <SignatureBox
                                label="Received by"
                                sublabel={stockOut.delivered_to}
                                blank
                            />
                        </div>

                        <p className="text-xs text-gray-500 italic mt-4">
                            Received the above merchandise in good order and
                            condition.
                        </p>

                        {/* ── FOOTER ──────────────────────────────── */}
                        <div className="border-t border-gray-300 mt-6 pt-3">
                            <p className="text-[10px] text-gray-400 text-center">
                                This document is system-generated · Delivery
                                Receipt #{receiptNumber(stockOut.stock_out_id)}{" "}
                                · Westpoint Pharmacy Management System
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Small internal components
// ─────────────────────────────────────────────────────────────────────

function FieldLine({ label, value }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="text-gray-500 whitespace-nowrap">{label}:</span>
            <span
                className="flex-1 border-b border-dotted border-gray-400 pb-0.5
                    text-gray-900 font-medium"
            >
                {value || "\u00A0"}
            </span>
        </div>
    );
}

function Th({ children, align = "center", className = "" }) {
    return (
        <th
            className={`border border-gray-800 px-3 py-2 text-xs font-semibold
            uppercase tracking-wide text-${align} ${className}`}
        >
            {children}
        </th>
    );
}

function Td({ children, align = "left", bold, mono }) {
    return (
        <td
            className={`border border-gray-300 px-3 py-2 h-8 text-${align}
            ${bold ? "font-semibold text-gray-800" : "text-gray-600"}
            ${mono ? "font-mono text-xs" : "text-sm"}`}
        >
            {children}
        </td>
    );
}

function SignatureBox({ label, name, sublabel, blank }) {
    return (
        <div className="space-y-2">
            <div className="border-b-2 border-gray-500 h-10" />
            <div className="text-xs text-gray-600 space-y-0.5 text-center">
                {!blank && name && (
                    <p className="font-semibold text-gray-800 uppercase">
                        {name}
                    </p>
                )}
                {blank && (
                    <p className="text-gray-300 italic">Signature above</p>
                )}
                <p className="text-[10px] uppercase tracking-widest text-gray-400">
                    {label}
                </p>
                {sublabel && <p className="text-gray-400">{sublabel}</p>}
            </div>
        </div>
    );
}

function PrintIcon() {
    return (
        <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
        </svg>
    );
}
