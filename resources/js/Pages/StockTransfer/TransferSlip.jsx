import { Head, Link } from "@inertiajs/react";
import { formatDate, formatDateTime } from "./lib/TransferHelpers";

/**
 * TransferSlip
 * Standalone printable slip — no AuthenticatedLayout so the nav
 * doesn't appear on print. Accessed via GET /stock-transfers/{id}/slip
 *
 * Styled after a classic ledger-style delivery receipt: bordered
 * table, fill-in-the-blank header fields, boxed totals, signature row.
 *
 * Props: transfer (with fromBranch, toBranch, requester, approver, items.product)
 */
export default function TransferSlip({ transfer }) {
    const totalQty = transfer.items?.reduce(
        (sum, item) =>
            sum + (item.quantity_approved ?? item.quantity_requested),
        0,
    );

    return (
        <>
            <Head title={`Slip — ${transfer.transfer_no}`} />

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
                    href={route("stock-transfers.index")}
                    className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5 transition"
                >
                    ← Back to transfers
                </Link>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 font-mono">
                        {transfer.transfer_no}
                    </span>
                    <button
                        onClick={() => window.print()}
                        className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white
                            hover:bg-blue-700 transition font-medium flex items-center gap-2"
                    >
                        <PrintIcon /> Print slip
                    </button>
                </div>
            </div>

            {/* ── Slip body ─────────────────────────────────────── */}
            <div className="min-h-screen py-8 px-4 flex justify-center">
                <div
                    className="slip-card w-full max-w-3xl bg-white
                    shadow-lg border border-gray-300 overflow-hidden font-serif"
                >
                    <div className="px-8 pt-6 pb-8">
                        {/* ── LETTERHEAD ──────────────────────────── */}
                        <div className="flex items-center justify-between gap-4 border-b-2 border-gray-800 pb-3 mb-4">
                            <img
                                src="/images/logo/Westpoint.png"
                                alt="Westpoint Pharmacy & Medical Supplies Distribution"
                                className="h-28 w-28 shrink-0 object-contain"
                            />
                            <div className="flex-1 text-center">
                                <h1 className="text-2xl font-bold uppercase tracking-tight text-gray-900">
                                    Westpoint
                                </h1>
                                <h1 className="text-2xl font-bold uppercase tracking-tight text-gray-900">
                                    Pharmacy &amp; Medical Supplies
                                </h1>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    Multi-Branch Inventory &amp; Stock Transfer
                                    System
                                </p>
                            </div>
                            {/* Invisible spacer matching the logo's width so the
                                centered text block stays visually centered rather
                                than drifting toward the logo. */}
                            <div
                                className="h-16 w-16 shrink-0"
                                aria-hidden="true"
                            />
                        </div>

                        <div className="flex items-start justify-between mb-4">
                            <h2 className="text-lg font-bold uppercase tracking-wide text-gray-900">
                                Stock Transfer Slip
                            </h2>
                            <p className="text-sm text-red-600 font-semibold whitespace-nowrap">
                                No.{" "}
                                <span className="font-mono">
                                    {transfer.transfer_no}
                                </span>
                            </p>
                        </div>

                        {/* ── HEADER FIELDS ───────────────────────── */}
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-5">
                            <FieldLine
                                label="Transferred from"
                                value={transfer.from_branch?.branch_name}
                            />
                            <FieldLine
                                label="Date"
                                value={formatDate(transfer.transfer_date)}
                            />
                            <FieldLine
                                label="Transferred to"
                                value={transfer.to_branch?.branch_name}
                            />
                            <FieldLine
                                label="Needed by"
                                value={
                                    transfer.needed_by
                                        ? formatDate(transfer.needed_by)
                                        : "—"
                                }
                            />
                            <FieldLine
                                label="Requested by"
                                value={transfer.requester?.name}
                            />
                            <FieldLine
                                label="Priority"
                                value={transfer.priority ?? "normal"}
                                capitalize
                            />
                            <FieldLine
                                label="Approved by"
                                value={transfer.approver?.name}
                            />
                            <FieldLine
                                label="Approved at"
                                value={formatDateTime(transfer.approved_at)}
                            />
                        </div>

                        {/* Reason */}
                        {transfer.reason && (
                            <div className="border border-gray-300 px-3 py-2 mb-5 text-sm">
                                <span className="text-gray-500">
                                    Reason for transfer:{" "}
                                </span>
                                <span className="text-gray-800">
                                    {transfer.reason}
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
                                </tr>
                            </thead>
                            <tbody>
                                {transfer.items?.map((item, idx) => {
                                    const qty =
                                        item.quantity_approved ??
                                        item.quantity_requested;
                                    const isPartial =
                                        item.quantity_approved !== null &&
                                        item.quantity_approved !==
                                            item.quantity_requested;

                                    return (
                                        <tr key={item.id}>
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
                                                {item.product?.unit ?? "—"}
                                            </Td>
                                            <Td align="right">
                                                <span className="font-bold">
                                                    {qty}
                                                </span>
                                                {isPartial && (
                                                    <span className="text-[10px] text-yellow-700 block">
                                                        of{" "}
                                                        {
                                                            item.quantity_requested
                                                        }{" "}
                                                        req.
                                                    </span>
                                                )}
                                            </Td>
                                        </tr>
                                    );
                                })}

                                {/* Blank filler rows for a consistent printed block, like a pre-printed pad */}
                                {Array.from({
                                    length: Math.max(
                                        0,
                                        4 - (transfer.items?.length ?? 0),
                                    ),
                                }).map((_, i) => (
                                    <tr key={`blank-${i}`}>
                                        <Td>&nbsp;</Td>
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
                                        colSpan={5}
                                        className="border border-gray-800 px-3 py-2 text-xs font-semibold
                                            text-gray-700 uppercase tracking-wide text-right"
                                    >
                                        Total units transferred
                                    </td>
                                    <td className="border border-gray-800 px-3 py-2 text-right font-bold text-gray-900 text-base">
                                        {totalQty}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* ── SIGNATURES ──────────────────────────── */}
                        <div className="grid grid-cols-3 gap-6 mt-8">
                            <SignatureBox
                                label="Prepared / Issued by"
                                name={transfer.requester?.name}
                                sublabel={transfer.from_branch?.branch_name}
                            />
                            <SignatureBox
                                label="Approved by"
                                name={transfer.approver?.name}
                                sublabel={
                                    transfer.approved_at
                                        ? formatDate(transfer.approved_at)
                                        : null
                                }
                            />
                            <SignatureBox
                                label="Received by"
                                sublabel={transfer.to_branch?.branch_name}
                                blank
                            />
                        </div>

                        <p className="text-xs text-gray-500 italic mt-4">
                            Received the above stock in good order and
                            condition.
                        </p>

                        {/* ── FOOTER ──────────────────────────────── */}
                        <div className="border-t border-gray-300 mt-6 pt-3">
                            <p className="text-[10px] text-gray-400 text-center">
                                This slip is system-generated ·{" "}
                                {transfer.transfer_no} · Westpoint Pharmacy
                                Management System
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

function FieldLine({ label, value, capitalize }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="text-gray-500 whitespace-nowrap">{label}:</span>
            <span
                className={`flex-1 border-b border-dotted border-gray-400 pb-0.5
                    text-gray-900 font-medium ${capitalize ? "capitalize" : ""}`}
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
