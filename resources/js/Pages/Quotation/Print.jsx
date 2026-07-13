import { Head } from "@inertiajs/react";
import { formatCurrency } from "./lib/quotationStatus";
import { formatCustomerName } from "./lib/customerName";

export default function Print({ quotation }) {
    const itemCount = quotation.items?.length ?? 0;

    return (
        <>
            <Head title={`Print — ${quotation.qt_no}`} />

            <div className="min-h-screen bg-slate-100 print:bg-white print:py-0">
                {/* Print button – hidden on paper */}
                <div className="mx-auto max-w-3xl p-4 text-right print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                    >
                        Print
                    </button>
                </div>

                {/* Main print area */}
                <div className="mx-auto max-w-3xl bg-white p-10 font-serif text-[13px] shadow print:max-w-none print:p-8 print:shadow-none">
                    {/* Letterhead */}
                    <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-3">
                        <div className="flex h-28 w-28 shrink-0 items-center justify-center">
                            <img
                                src="/storage/westpoint_logo.png"
                                alt="Westpoint Pharmacy & Medical Supplies Distribution"
                                className="h-30 w-30 object-contain"
                            />
                        </div>
                        <div className="flex-1 text-center">
                            <h1 className="text-xl font-extrabold uppercase tracking-wide">
                                Westpoint Pharmacy &amp; Medical Supplies
                                Trading
                            </h1>
                            <p className="mt-0.5 text-[10px] text-slate-600">
                                5th Street, Bacolod City, Philippines, 6100
                                &nbsp;•&nbsp; westpointpharmamed@gmail.com
                            </p>
                            <p className="text-[10px] text-slate-600">
                                Cellphone No.: 0917 162 8332 &nbsp;•&nbsp;
                                Telephone No.: 454-1118
                            </p>
                        </div>
                        {/* spacer balances the logo so the text block is truly centered */}
                        <div
                            className="h-14 w-14 shrink-0"
                            aria-hidden="true"
                        />
                    </div>

                    <h2 className="mt-3 text-center text-base font-bold uppercase tracking-wider underline underline-offset-4">
                        Quotation Form
                    </h2>

                    {/* S.ID, Date, Delivery Type */}
                    <div className="mt-2 flex items-center justify-between text-[12px]">
                        <p>
                            S.ID:{" "}
                            <span className="font-semibold">
                                {quotation.sid_no || "—"}
                            </span>
                        </p>
                        <p className="text-right">
                            Date:{" "}
                            <span className="inline-block min-w-[90px] border-b border-slate-500 px-1 text-center">
                                {quotation.qt_date?.slice(0, 10) || "\u00A0"}
                            </span>
                            <span className="ml-4 capitalize">
                                {quotation.delivery_type}
                            </span>
                        </p>
                    </div>

                    {/* Customer & Q.F. No. block */}
                    <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-6 rounded border border-slate-300 px-4 py-3 text-[12px]">
                        <div className="space-y-1.5">
                            <div className="flex gap-2">
                                <span className="w-20 text-slate-500">
                                    Customer:
                                </span>
                                <span className="flex-1 border-b border-dotted border-slate-400 font-medium">
                                    {formatCustomerName(quotation.customer)}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <span className="w-20 text-slate-500">
                                    Address:
                                </span>
                                <span className="flex-1 border-b border-dotted border-slate-400">
                                    {quotation.address ||
                                        quotation.customer?.address}
                                </span>
                            </div>
                            {(quotation.customer?.lto_no ||
                                quotation.customer?.lto_expiration) && (
                                <div className="flex gap-2">
                                    <span className="w-20 text-slate-500">
                                        LTO No.:
                                    </span>
                                    <span className="flex-1 border-b border-dotted border-slate-400">
                                        {quotation.customer?.lto_no}
                                        {quotation.customer?.lto_expiration &&
                                            ` — Expiration: ${quotation.customer.lto_expiration.slice(0, 10)}`}
                                    </span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <span className="w-20 text-slate-500">
                                    Remarks:
                                </span>
                                <span className="flex-1 border-b border-dotted border-slate-400">
                                    {quotation.qt_remarks || "\u00A0"}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5 text-right">
                            <p>
                                <span className="text-slate-500">
                                    Q.F. No.:
                                </span>{" "}
                                <span className="font-semibold">
                                    {quotation.qt_no}
                                </span>
                            </p>
                            <p>
                                <span className="inline-block min-w-[70px] border-b border-slate-400 px-1">
                                    {quotation.form_no || "\u00A0"}
                                </span>
                            </p>
                            <p>
                                <span className="text-slate-500">
                                    Checked by:
                                </span>{" "}
                                <span className="inline-block min-w-[90px] border-b border-slate-400 px-1">
                                    {quotation.checked_by || "\u00A0"}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Item table */}
                    <table className="mt-4 w-full border-collapse text-[12px]">
                        <thead>
                            <tr className="bg-slate-900 text-[11px] uppercase tracking-wide text-white">
                                <th className="border border-slate-900 px-2 py-1.5 text-left">
                                    Quantity
                                </th>
                                <th className="border border-slate-900 px-2 py-1.5 text-left">
                                    Unit
                                </th>
                                <th className="border border-slate-900 px-2 py-1.5 text-left">
                                    Description
                                </th>
                                <th className="border border-slate-900 px-2 py-1.5 text-right">
                                    Unit Price
                                </th>
                                <th className="border border-slate-900 px-2 py-1.5 text-right">
                                    Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotation.items?.map((item) => (
                                <tr key={item.id}>
                                    <td className="border border-slate-200 px-2 py-1.5 align-top">
                                        {item.qt_qty}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1.5 align-top">
                                        {item.qt_unit || "—"}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1.5 align-top">
                                        <p>{item.qt_description}</p>
                                        {(item.lot_number ||
                                            item.expiry_date) && (
                                            <p className="mt-0.5 text-[11px] text-slate-500">
                                                {item.lot_number &&
                                                    `Lot No.: ${item.lot_number}`}
                                                {item.lot_number &&
                                                    item.expiry_date &&
                                                    "   "}
                                                {item.expiry_date &&
                                                    `Expiry Date: ${item.expiry_date.slice(0, 10)}`}
                                            </p>
                                        )}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1.5 text-right align-top">
                                        {formatCurrency(item.qt_unit_price)}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1.5 text-right align-top font-medium">
                                        {formatCurrency(item.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Item count & end marker */}
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                        <p>Item(s): {itemCount}</p>
                        <p className="italic">*** nothing follows ***</p>
                    </div>

                    {/* Total */}
                    <div className="mt-4 flex justify-end border-t-2 border-slate-900 pt-2">
                        <div className="flex w-64 justify-between bg-slate-50 px-3 py-2 text-sm font-bold">
                            <span>TOTAL AMOUNT</span>
                            <span>
                                {formatCurrency(quotation.total_amount)}
                            </span>
                        </div>
                    </div>

                    {/* Page info & received note */}
                    <div className="mt-6 flex justify-between text-[10px] text-slate-500">
                        <div>
                            <p>Page 1 of 1</p>
                            <p>
                                Printed by: {quotation.printed_by} &nbsp; Time:{" "}
                                {quotation.time_printed}
                            </p>
                        </div>
                        <p className="italic">
                            Received above merchandise in good order and
                            condition.
                        </p>
                    </div>

                    {/* Signatures – evenly aligned */}
                    <div className="mt-6 grid grid-cols-3 gap-6 text-center text-[11px]">
                        <div>
                            <p className="mb-1 border-b border-slate-500 pb-6">
                                &nbsp;
                            </p>
                            <p className="font-medium">
                                {quotation.prepared_by || "\u00A0"}
                            </p>
                            <p className="text-slate-500">Prepared by</p>
                        </div>
                        <div>
                            <p className="mb-1 border-b border-slate-500 pb-6">
                                &nbsp;
                            </p>
                            <p className="font-medium">
                                {quotation.form_no || quotation.qt_no}
                            </p>
                            <p className="text-slate-500">No.</p>
                        </div>
                        <div>
                            <p className="mb-1 border-b border-slate-500 pb-6">
                                &nbsp;
                            </p>
                            <p className="font-medium">
                                {quotation.received_by || "\u00A0"}
                            </p>
                            <p className="text-slate-500">Received by</p>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="mt-6 text-center text-[10px] italic text-slate-500">
                        NOTE: Our Collection Receipt will be issued upon
                        approval of this Quotation Form and signed by the
                        customers.
                    </p>
                </div>
            </div>
        </>
    );
}
