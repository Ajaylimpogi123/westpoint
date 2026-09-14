import React, { useEffect } from "react";
import { Head } from "@inertiajs/react";
import { formatDateTime } from "@/lib/dates";

export default function ReceiptPrint({ sale }) {
    useEffect(() => {
        window.print();
    }, []);

    const formatCurrency = (amount) =>
        `P${Number(amount || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const customerName =
        sale.customer_name && String(sale.customer_name).trim() !== ""
            ? sale.customer_name
            : "Walk-in";

    const cashierName = sale.user?.name || "—";

    const productLabel = (product) => {
        if (!product) return "Product";
        const parts = [
            product.med_name,
            product.dose,
            product.form,
            product.brand_name,
        ]
            .filter(Boolean)
            .join(" ");
        return parts || "Product";
    };

    const items = sale.items ?? [];

    const refundedAmount = Number(sale.refunded_amount) || 0;
    const amountDue = Math.max(
        (Number(sale.net_amount) || 0) - refundedAmount,
        0,
    );
    const hasRemarks =
        sale.sales_remarks && String(sale.sales_remarks).trim() !== "";

    return (
        <>
            <Head title={`Receipt #${sale.invoice_number}`} />

            <style>{`
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                @media print {
                    body {
                        font-family: 'Courier New', monospace;
                        width: 72mm;
                        margin: 0 auto;
                        padding: 4mm 2mm;
                        font-size: 11px;
                    }
                }
                body {
                    font-family: 'Courier New', monospace;
                    width: 72mm;
                    margin: 0 auto;
                    padding: 4mm 2mm;
                    font-size: 11px;
                    color: #000;
                }
                .header {
                    text-align: center;
                    margin-bottom: 8px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 8px;
                }
                .header h1 {
                    font-size: 14px;
                    margin: 0;
                    letter-spacing: 0.5px;
                }
                .header p {
                    margin: 2px 0;
                    font-size: 10px;
                    line-height: 1.3;
                }
                .invoice-title {
                    text-align: center;
                    font-weight: bold;
                    font-size: 12px;
                    letter-spacing: 1px;
                    margin: 6px 0;
                }
                .status-badge {
                    text-align: center;
                    font-weight: bold;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                    margin: 0 0 6px 0;
                }
                .order-info {
                    margin-bottom: 10px;
                }
                .order-info div {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                    gap: 8px;
                }
                .remarks-box {
                    border: 1px dashed #000;
                    padding: 4px;
                    margin-bottom: 8px;
                    font-size: 9px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                    table-layout: fixed;
                }
                th, td {
                    padding: 3px 2px;
                    text-align: left;
                    font-size: 10px;
                    vertical-align: top;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                th {
                    border-bottom: 1px solid #000;
                }
                td.num, th.num {
                    text-align: right;
                    white-space: nowrap;
                }
                .line-discount {
                    font-size: 9px;
                    color: #333;
                }
                .line-vat-tag {
                    font-size: 9px;
                    color: #333;
                }
                .line-returned {
                    font-size: 9px;
                    color: #a15c00;
                }
                col.col-item {
                    width: 40%;
                }
                col.col-unit {
                    width: 16%;
                }
                col.col-price {
                    width: 16%;
                }
                col.col-qty {
                    width: 10%;
                }
                col.col-total {
                    width: 18%;
                }
                .totals {
                    border-top: 1px solid #000;
                    margin-top: 8px;
                    padding-top: 8px;
                }
                .totals div {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                }
                .totals .strike {
                    text-decoration: line-through;
                    color: #555;
                }
                .footer {
                    text-align: center;
                    margin-top: 14px;
                    border-top: 1px dashed #000;
                    padding-top: 8px;
                }
                .footer p {
                    font-size: 10px;
                    margin: 2px 0;
                }
            `}</style>

            <div className="header">
                <h1>WESTPOINT PHARMA &amp; MEDICAL SUPPLIES DISTRIBUTION</h1>
                <p>TIN: 439-169-208-00000</p>
                <p>6th Lacson St., Bacolod City, Negros Occidental, 6100</p>
                <p>sales@westpointpharma.com</p>
                <p>Wholesale Quotations: (034)4792739/(0992)9895971</p>
                <p>Retail pricing: (034) 454 1118 / (0917) 162 8332</p>
            </div>

            <div className="invoice-title">RECEIPT (REPRINT)</div>

            {sale.status && sale.status !== "Completed" && (
                <div className="status-badge">{sale.status.toUpperCase()}</div>
            )}

            <div className="order-info">
                <div>
                    <span>Invoice #:</span>
                    <strong>{sale.invoice_number}</strong>
                </div>
                <div>
                    <span>Date:</span>
                    <strong>{formatDateTime(sale.created_at, "")}</strong>
                </div>
                <div>
                    <span>Cashier:</span>
                    <strong>{cashierName}</strong>
                </div>
                <div>
                    <span>Customer:</span>
                    <strong>{customerName}</strong>
                </div>
            </div>

            {/* {hasRemarks && (
                <div className="remarks-box">
                    <strong>Remarks:</strong> {sale.sales_remarks}
                </div>
            )} */}

            <table>
                <colgroup>
                    <col className="col-item" />
                    <col className="col-unit" />
                    <col className="col-price" />
                    <col className="col-qty" />
                    <col className="col-total" />
                </colgroup>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th className="num">Unit</th>
                        <th className="num">Price</th>
                        <th className="num">Qty</th>
                        <th className="num">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length > 0 ? (
                        items.map((item) => {
                            const isVatLine =
                                item.product?.vat_status === "VAT" &&
                                !item.vat_exempt;

                            return (
                                <tr key={item.id}>
                                    <td>
                                        {productLabel(item.product)}
                                        {isVatLine && (
                                            <div className="line-vat-tag">
                                                VAT
                                            </div>
                                        )}
                                        {item.vat_exempt && (
                                            <div className="line-vat-tag">
                                                VAT-Exempt
                                            </div>
                                        )}
                                        {item.returned_quantity > 0 && (
                                            <div className="line-returned">
                                                Returned:{" "}
                                                {item.returned_quantity}
                                            </div>
                                        )}
                                    </td>
                                    <td className="num">{item.unit_type}</td>
                                    <td className="num">
                                        {formatCurrency(item.price_used)}
                                    </td>
                                    <td className="num">
                                        {item.quantity_sold}
                                    </td>
                                    <td className="num">
                                        {formatCurrency(item.total_price)}
                                        {Number(item.discount_amount) > 0 && (
                                            <div className="line-discount">
                                                -
                                                {formatCurrency(
                                                    item.discount_amount,
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="5" style={{ textAlign: "center" }}>
                                No items found
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="totals">
                <div>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(sale.gross_amount)}</span>
                </div>
                {Number(sale.discount_amount) > 0 && (
                    <div>
                        <span>
                            Discount
                            {sale.discount_type
                                ? ` (${sale.discount_type})`
                                : ""}
                            :
                        </span>
                        <span>-{formatCurrency(sale.discount_amount)}</span>
                    </div>
                )}
                {refundedAmount > 0 && (
                    <>
                        <div className="strike">
                            <span>Original Total:</span>
                            <span>{formatCurrency(sale.net_amount)}</span>
                        </div>
                        <div>
                            <span>Refunded / Voided:</span>
                            <span>-{formatCurrency(refundedAmount)}</span>
                        </div>
                    </>
                )}
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                    <span>{refundedAmount > 0 ? "AMOUNT DUE:" : "TOTAL:"}</span>
                    <span>{formatCurrency(amountDue)}</span>
                </div>
                <div>
                    <span>Payment Method:</span>
                    <span className="capitalize">
                        {String(sale.payment_method).replace(/_/g, " ")}
                    </span>
                </div>
                {sale.payment_method === "cash" && (
                    <>
                        <div>
                            <span>Amount Received:</span>
                            <span>{formatCurrency(sale.amount_received)}</span>
                        </div>
                        <div>
                            <span>Change:</span>
                            <span>{formatCurrency(sale.change_due)}</span>
                        </div>
                    </>
                )}
                {sale.reference_number &&
                    String(sale.reference_number).trim() !== "" && (
                        <div>
                            <span>Reference #:</span>
                            <span>{sale.reference_number}</span>
                        </div>
                    )}
            </div>

            <div className="footer">
                <p style={{ fontSize: "9px" }}>
                    This Document is not valid for claim of input taxes. Please
                    ask for the official Sales Invoice
                </p>
            </div>
        </>
    );
}
