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

function formatExpiryShort(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const month = date
        .toLocaleDateString("en-US", { month: "short" })
        .toUpperCase();
    const year = String(date.getFullYear()).slice(-2);
    return `${month}-${year}`;
}

function formatCurrency(amount) {
    return `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function receiptNumber(stockInId) {
    return String(stockInId ?? "").padStart(6, "0");
}

function unitLabel(unitType) {
    return unitType === "Box" ? "BOX" : "PC";
}

const ONES = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
];
const TENS = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
];

function wordsUnder1000(n) {
    if (n === 0) return "";
    if (n < 20) return ONES[n];
    if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return r ? `${TENS[t]} ${ONES[r]}` : TENS[t];
    }
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r ? `${ONES[h]} HUNDRED ${wordsUnder1000(r)}` : `${ONES[h]} HUNDRED`;
}

function integerToWords(n) {
    if (n === 0) return "ZERO";
    let words = "";
    const millions = Math.floor(n / 1_000_000);
    const thousands = Math.floor((n % 1_000_000) / 1000);
    const rest = n % 1000;
    if (millions) {
        words += `${wordsUnder1000(millions)} MILLION`;
    }
    if (thousands) {
        words += words
            ? ` ${wordsUnder1000(thousands)} THOUSAND`
            : `${wordsUnder1000(thousands)} THOUSAND`;
    }
    if (rest) {
        words += words ? ` ${wordsUnder1000(rest)}` : wordsUnder1000(rest);
    }
    return words.trim();
}

function amountInWords(amount) {
    const value = Number(amount || 0);
    const pesos = Math.floor(Math.abs(value));
    const centavos = Math.round((Math.abs(value) - pesos) * 100);
    let result = integerToWords(pesos);
    result += pesos === 1 ? " PESO" : " PESOS";
    if (centavos > 0) {
        result += ` AND ${integerToWords(centavos)}`;
        result += centavos === 1 ? " CENTAVO" : " CENTAVOS";
    }
    result += " ONLY";
    return result;
}

const MIN_TABLE_ROWS = 14;
const WESTPOINT_ADDRESS =
    "6th Lacson St., Bacolod City, Negros Occidental, 6100";

/**
 * StockInReceipt
 * Standalone printable delivery receipt for stock-in transactions.
 * Accessed via GET /stock-in/{id}/receipt
 */
export default function StockInReceipt({ stockIn }) {
    const items = stockIn.items ?? [];

    const priceFor = (item) => {
        if (!item?.product) return 0;
        const value =
            item.unit_type === "Box"
                ? item.product.wholesale_price
                : item.product.retail_price;
        return Number(value || 0);
    };

    const totalAmount = useMemo(() => {
        return items.reduce((sum, item) => {
            const unitPrice = priceFor(item);
            return sum + unitPrice * Number(item.quantity_received || 0);
        }, 0);
    }, [items]);

    const blankRowCount = Math.max(0, MIN_TABLE_ROWS - items.length);

    return (
        <>
            <Head
                title={`Delivery Receipt — #${receiptNumber(stockIn.stock_in_id)}`}
            />

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    html, body {
                        background: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: letter portrait;
                        margin: 0.5in;
                    }
                    .slip-card {
                        box-shadow: none !important;
                        border: none !important;
                        max-width: none !important;
                        width: 100% !important;
                        padding: 0 !important;
                    }
                }
                @media screen {
                    body { background: #f3f4f6; }
                }
            `}</style>

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
                        #{receiptNumber(stockIn.stock_in_id)}
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

            <div className="min-h-screen py-6 px-4 flex justify-center print:py-0 print:px-0">
                <div
                    className="slip-card w-full max-w-[8.5in] bg-white
                    shadow-lg border border-gray-300 overflow-hidden font-serif text-[11px] text-gray-900
                    print:shadow-none print:border-0 px-8 py-6 print:px-0 print:py-0"
                >
                    <div className="flex items-start gap-3 border-b-2 border-gray-900 pb-2 mb-1">
                        <img
                            src="/images/logo/Westpoint.png"
                            alt="Westpoint Pharma and Medical Supplies Distribution"
                            className="h-28 w-28 shrink-0 object-contain"
                        />
                        <div className="flex-1 text-center pt-0.5">
                            <h1 className="text-[15px] font-bold uppercase leading-tight tracking-tight">
                                Westpoint Pharma and Medical Supplies
                                Distribution
                            </h1>
                            <p className="text-[9px] mt-0.5 leading-snug">
                                {WESTPOINT_ADDRESS}
                            </p>
                            <p className="text-[9px] leading-snug">
                                VAT Reg. TIN: 439-169-208-00000
                            </p>
                            <p className="text-[9px] leading-snug">
                                Bulk/Wholesale: (034) 479 2739 / (0992) 989 5971
                                &nbsp;•&nbsp; Retail: (034) 454 1118 / (0917)
                                162 8332
                            </p>
                        </div>
                        <div className="w-16 shrink-0" aria-hidden="true" />
                    </div>

                    <div className="relative mb-3">
                        <h2 className="text-center text-sm font-bold uppercase tracking-widest">
                            Delivery Receipt
                        </h2>
                        <p className="absolute right-0 top-0 text-xs font-semibold text-red-600">
                            №{" "}
                            <span className="font-mono">
                                {receiptNumber(stockIn.stock_in_id)}
                            </span>
                        </p>
                    </div>

                    <div className="border border-gray-900 mb-2">
                        <div className="grid grid-cols-[1fr_140px] border-b border-gray-900">
                            <HeaderCell label="Delivered to">
                                {stockIn.branch?.branch_name}
                            </HeaderCell>
                            <HeaderCell label="Date" borderedLeft>
                                {formatDate(stockIn.delivery_date)}
                            </HeaderCell>
                        </div>
                        <div className="grid grid-cols-[1fr_140px] border-b border-gray-900">
                            <HeaderCell label="TIN" blank />
                            <HeaderCell label="Terms" borderedLeft blank />
                        </div>
                        <div className="grid grid-cols-[1fr_140px]">
                            <HeaderCell label="Address">
                                {WESTPOINT_ADDRESS}
                            </HeaderCell>
                            <HeaderCell label="Invoice #" borderedLeft blank />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-2 text-[10px]">
                        <FieldLine
                            label="Supplier"
                            value={stockIn.supplier_name}
                        />
                        <FieldLine
                            label="Destination branch"
                            value={stockIn.branch?.branch_name}
                        />
                        <FieldLine
                            label="Received by"
                            value={stockIn.received_by}
                        />
                        <FieldLine
                            label="Recorded"
                            value={formatDate(stockIn.created_at)}
                        />
                    </div>

                    {stockIn.remarks && (
                        <div className="border border-gray-400 px-2 py-1 mb-2 text-[10px]">
                            <span className="text-gray-600">Remarks: </span>
                            <span>{stockIn.remarks}</span>
                        </div>
                    )}

                    <table className="w-full border-collapse border border-gray-900 text-[10px]">
                        <thead>
                            <tr className="bg-white">
                                <Th className="w-8">No.</Th>
                                <Th align="left">Description</Th>
                                <Th className="w-[72px]">Batch No.</Th>
                                <Th className="w-[68px]">Expiry Date</Th>
                                <Th className="w-12">Unit</Th>
                                <Th className="w-10" align="right">
                                    Qty.
                                </Th>
                                <Th className="w-[72px]" align="right">
                                    Unit Price
                                </Th>
                                <Th className="w-[76px]" align="right">
                                    Amount
                                </Th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => {
                                const qty = Number(item.quantity_received || 0);
                                const unitPrice = priceFor(item);
                                const amount = unitPrice * qty;

                                return (
                                    <tr key={item.item_id ?? idx}>
                                        <Td align="center">{idx + 1}</Td>
                                        <Td align="left">
                                            <span className="font-semibold">
                                                {item.product?.med_name ?? "—"}
                                            </span>
                                            {(item.product?.dose ||
                                                item.product?.form ||
                                                item.product?.brand_name) && (
                                                <span className="block text-[9px] text-gray-600">
                                                    {item.product?.dose ?? ""}
                                                    {item.product?.form
                                                        ? ` / ${item.product.form}`
                                                        : ""}
                                                    {item.product?.brand_name
                                                        ? ` — ${item.product.brand_name}`
                                                        : ""}
                                                </span>
                                            )}
                                        </Td>
                                        <Td align="center" mono>
                                            {item.batch_number ?? "—"}
                                        </Td>
                                        <Td align="center">
                                            {formatExpiryShort(item.expiry_date)}
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

                            {Array.from({ length: blankRowCount }).map(
                                (_, i) => (
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
                                ),
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td
                                    colSpan={5}
                                    rowSpan={3}
                                    className="border border-gray-900 align-top p-2"
                                >
                                    <p className="text-[9px] font-semibold uppercase mb-1">
                                        Amount in Words
                                    </p>
                                    <p className="text-[10px] font-medium leading-snug min-h-[3rem]">
                                        {amountInWords(totalAmount)}
                                    </p>
                                </td>
                                <td
                                    colSpan={2}
                                    className="border border-gray-900 px-2 py-1 text-right font-semibold uppercase text-[9px]"
                                >
                                    Total Sales
                                </td>
                                <td className="border border-gray-900 px-2 py-1 text-right">
                                    {formatCurrency(totalAmount)}
                                </td>
                            </tr>
                            <tr>
                                <td
                                    colSpan={2}
                                    className="border border-gray-900 px-2 py-1 text-right font-semibold uppercase text-[9px]"
                                >
                                    Less: Withholding Tax
                                </td>
                                <td className="border border-gray-900 px-2 py-1 text-right">
                                    &nbsp;
                                </td>
                            </tr>
                            <tr>
                                <td
                                    colSpan={2}
                                    className="border border-gray-900 px-2 py-1 text-right font-bold uppercase text-[9px]"
                                >
                                    Total Amount Due
                                </td>
                                <td className="border border-gray-900 px-2 py-1 text-right font-bold text-xs">
                                    {formatCurrency(totalAmount)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="mt-6 grid grid-cols-[1fr_200px] gap-4 items-end">
                        <div className="grid grid-cols-3 gap-3">
                            <SignatureBox
                                label="Prepared By"
                                name={stockIn.received_by}
                            />
                            <SignatureBox label="Pre-approved By" blank />
                            <SignatureBox label="Approved By" blank />
                        </div>
                        <div className="text-[9px]">
                            <p className="italic mb-6 leading-snug">
                                Received the above merchandise in good order and
                                condition
                            </p>
                            <p>
                                <span className="font-semibold">By:</span>{" "}
                                <span className="inline-block min-w-[120px] border-b border-gray-800">
                                    &nbsp;
                                </span>
                            </p>
                            <p className="text-[8px] text-center mt-0.5 text-gray-600">
                                Signature Over Printed Name / Date
                            </p>
                        </div>
                    </div>

                    <p className="text-center text-[10px] font-bold uppercase mt-6 tracking-wide">
                        This document is not valid for claiming of input taxes
                    </p>

                    <p className="text-[8px] text-gray-400 text-center mt-2">
                        System-generated · Delivery Receipt #
                        {receiptNumber(stockIn.stock_in_id)} · Westpoint
                        Pharmacy Management System
                    </p>
                </div>
            </div>
        </>
    );
}

function HeaderCell({ label, children, borderedLeft, blank }) {
    return (
        <div
            className={`flex min-h-[26px] items-end gap-1 px-2 py-1 ${
                borderedLeft ? "border-l border-gray-900" : ""
            }`}
        >
            <span className="shrink-0 font-semibold">{label}</span>
            <span className="flex-1 border-b border-gray-700 pb-px min-h-[14px]">
                {blank ? "\u00A0" : children || "\u00A0"}
            </span>
        </div>
    );
}

function FieldLine({ label, value }) {
    return (
        <div className="flex items-baseline gap-1">
            <span className="text-gray-600 whitespace-nowrap">{label}:</span>
            <span className="flex-1 border-b border-dotted border-gray-500 pb-px text-gray-900">
                {value || "\u00A0"}
            </span>
        </div>
    );
}

function Th({ children, align = "center", className = "" }) {
    const alignClass =
        align === "right"
            ? "text-right"
            : align === "left"
              ? "text-left"
              : "text-center";
    return (
        <th
            className={`border border-gray-900 px-1 py-1 text-[9px] font-bold uppercase ${alignClass} ${className}`}
        >
            {children}
        </th>
    );
}

function Td({ children, align = "left", mono }) {
    const alignClass =
        align === "right"
            ? "text-right"
            : align === "center"
              ? "text-center"
              : "text-left";
    return (
        <td
            className={`border border-gray-900 px-1 py-0.5 h-6 ${alignClass}
            text-gray-800 ${mono ? "font-mono text-[9px]" : ""}`}
        >
            {children}
        </td>
    );
}

function SignatureBox({ label, name, blank }) {
    return (
        <div>
            <div className="border-b border-gray-800 h-8 mb-1" />
            {!blank && name && (
                <p className="text-[9px] font-semibold text-center uppercase truncate">
                    {name}
                </p>
            )}
            <p className="text-[8px] font-bold uppercase text-center tracking-wide">
                {label}
            </p>
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
