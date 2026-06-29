import { Head, Link } from "@inertiajs/react";
import { formatDate, formatDateTime } from "./lib/TransferHelpers";

/**
 * TransferSlip
 * Standalone printable slip — no AuthenticatedLayout so the nav
 * doesn't appear on print. Accessed via GET /stock-transfers/{id}/slip
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
                    className="slip-card w-full max-w-3xl bg-white rounded-xl
                    shadow-lg border border-gray-200 overflow-hidden"
                >
                    {/* ── HEADER ──────────────────────────────────── */}
                    <div className="bg-blue-700 text-white px-8 py-5 flex items-start justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-blue-200 mb-0.5">
                                Westpoint Pharmacy
                            </p>
                            <h1 className="text-xl font-bold tracking-tight">
                                Stock Transfer Slip
                            </h1>
                            <p className="text-sm text-blue-200 mt-1 font-mono">
                                {transfer.transfer_no}
                            </p>
                        </div>

                        {/* APPROVED stamp */}
                        <div className="border-2 border-green-400 rounded-lg px-4 py-2 text-center mt-1">
                            <p className="text-[10px] uppercase tracking-widest text-green-300">
                                Status
                            </p>
                            <p className="text-base font-bold text-green-300 uppercase tracking-wider">
                                Approved
                            </p>
                        </div>
                    </div>

                    <div className="px-8 py-6 space-y-6">
                        {/* ── ROUTE + META ────────────────────────── */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* From */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                                    Transferred from
                                </p>
                                <p className="text-base font-bold text-gray-800">
                                    {transfer.from_branch?.branch_name ?? "—"}
                                </p>
                                <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                                    <Row
                                        label="Requested by"
                                        value={transfer.requester?.name ?? "—"}
                                    />
                                    <Row
                                        label="Transfer date"
                                        value={formatDate(
                                            transfer.transfer_date,
                                        )}
                                    />
                                    {transfer.needed_by && (
                                        <Row
                                            label="Needed by"
                                            value={formatDate(
                                                transfer.needed_by,
                                            )}
                                        />
                                    )}
                                    <Row
                                        label="Priority"
                                        value={transfer.priority ?? "normal"}
                                        capitalize
                                    />
                                </div>
                            </div>

                            {/* To */}
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                                    Transferred to
                                </p>
                                <p className="text-base font-bold text-gray-800">
                                    {transfer.to_branch?.branch_name ?? "—"}
                                </p>
                                <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                                    <Row
                                        label="Approved by"
                                        value={transfer.approver?.name ?? "—"}
                                    />
                                    <Row
                                        label="Approved at"
                                        value={formatDateTime(
                                            transfer.approved_at,
                                        )}
                                    />
                                    <Row
                                        label="Slip printed"
                                        value={formatDateTime(
                                            new Date().toISOString(),
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Reason */}
                        {transfer.reason && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                                <p className="text-[10px] uppercase tracking-widest text-yellow-600 mb-1">
                                    Reason for transfer
                                </p>
                                <p className="text-sm text-yellow-800">
                                    {transfer.reason}
                                </p>
                            </div>
                        )}

                        {/* ── ITEMS TABLE ──────────────────────────── */}
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
                                Items transferred
                            </p>

                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-gray-800 text-white">
                                        <Th>#</Th>
                                        <Th>Medicine</Th>
                                        <Th>Dose / Form</Th>
                                        <Th>Brand</Th>
                                        <Th>Lot No.</Th>
                                        <Th>Expiry</Th>
                                        <Th align="right">Qty</Th>
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
                                            <tr
                                                key={item.id}
                                                className={
                                                    idx % 2 === 0
                                                        ? "bg-white"
                                                        : "bg-gray-50"
                                                }
                                            >
                                                <Td>{idx + 1}</Td>
                                                <Td bold>
                                                    {item.product?.med_name ??
                                                        "—"}
                                                </Td>
                                                <Td>
                                                    {item.product?.dose ?? "—"}
                                                    {item.product?.form
                                                        ? ` / ${item.product.form}`
                                                        : ""}
                                                </Td>
                                                <Td>
                                                    {item.product?.brand_name ??
                                                        "—"}
                                                </Td>
                                                <Td mono>{item.lot_number}</Td>
                                                <Td>
                                                    {formatDate(item.expiry)}
                                                </Td>
                                                <Td align="right">
                                                    <span className="font-bold">
                                                        {qty}
                                                    </span>
                                                    {isPartial && (
                                                        <span className="text-[10px] text-yellow-600 block">
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
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300 bg-gray-100">
                                        <td
                                            colSpan={6}
                                            className="px-3 py-2 text-xs font-semibold
                                                text-gray-600 uppercase tracking-wide text-right"
                                        >
                                            Total units transferred
                                        </td>
                                        <td
                                            className="px-3 py-2 text-right font-bold
                                            text-gray-900 text-base"
                                        >
                                            {totalQty}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* ── SIGNATURES ──────────────────────────── */}
                        <div className="grid grid-cols-2 gap-8 pt-4">
                            <SignatureBox
                                label="Prepared / Issued by"
                                name={transfer.requester?.name}
                                sublabel={transfer.from_branch?.branch_name}
                            />
                            <SignatureBox
                                label="Received by"
                                sublabel={transfer.to_branch?.branch_name}
                                blank
                            />
                        </div>

                        {/* ── FOOTER ──────────────────────────────── */}
                        <div className="border-t border-gray-200 pt-4">
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

function Row({ label, value, capitalize }) {
    return (
        <div className="flex items-baseline justify-between gap-2">
            <span className="text-gray-400 flex-shrink-0">{label}</span>
            <span
                className={`font-medium text-gray-700 text-right ${capitalize ? "capitalize" : ""}`}
            >
                {value}
            </span>
        </div>
    );
}

function Th({ children, align = "left" }) {
    return (
        <th
            className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide
            border border-gray-700 text-${align}`}
        >
            {children}
        </th>
    );
}

function Td({ children, align = "left", bold, mono }) {
    return (
        <td
            className={`px-3 py-2.5 border border-gray-200 text-${align}
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
            <p className="text-[10px] uppercase tracking-widest text-gray-400">
                {label}
            </p>
            {/* Signature line */}
            <div className="border-b-2 border-gray-400 h-10" />
            <div className="text-xs text-gray-600 space-y-0.5">
                {!blank && name && (
                    <p className="font-semibold text-gray-800">{name}</p>
                )}
                {!blank && sublabel && (
                    <p className="text-gray-400">{sublabel}</p>
                )}
                {blank && (
                    <p className="text-gray-300 italic">Signature above</p>
                )}
            </div>
            <p className="text-[10px] text-gray-400">
                Date: ___________________
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
