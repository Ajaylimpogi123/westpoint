import React, { useEffect } from "react";
import { Head } from "@inertiajs/react";
import { formatDateTime } from "@/lib/dates";

export default function InvoiceReceipt({ sale }) {
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

    return (
        <>
            <Head title={`Invoice #${sale.invoice_number}`} />

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
                .logo-wrap {
                    text-align: center;
                    margin-bottom: 4px;
                }
                .logo-wrap img {
                    max-width: 45mm;
                    max-height: 22mm;
                    object-fit: contain;
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
                .order-info {
                    margin-bottom: 10px;
                }
                .order-info div {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                    gap: 8px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                }
                th, td {
                    padding: 3px 0;
                    text-align: left;
                    font-size: 10px;
                    vertical-align: top;
                }
                th {
                    border-bottom: 1px solid #000;
                }
                td.num, th.num {
                    text-align: right;
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

            <div className="logo-wrap">
                <img src="/storage/westpoint_logo.png" alt="Westpoint Pharmacy & Medical Supplies Trading" />
            </div>

            <div className="header">
                <h1>WESTPOINT PHARMACY &amp; MEDICAL SUPPLIES TRADING</h1>
                <p>TIN: 439-169-208-00000</p>
                <p>6th Lacson St., Bacolod City, Negros Occidental, 6100</p>
                <p>Bulk/Wholesale Quotations: (034) 479 2739 / (0992) 989 5971</p>
                <p>Retail pricing: (034) 454 1118 / (0917) 162 8332</p>
            </div>

            <div className="invoice-title">SALES INVOICE</div>

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

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th className="num">Unit</th>
                        <th className="num">Qty</th>
                        <th className="num">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items && sale.items.length > 0 ? (
                        sale.items.map((item) => (
                            <tr key={item.id}>
                                <td>{productLabel(item.product)}</td>
                                <td className="num">{item.unit_type}</td>
                                <td className="num">{item.quantity_sold}</td>
                                <td className="num">{formatCurrency(item.total_price)}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="4" style={{ textAlign: "center" }}>
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
                        <span>Discount:</span>
                        <span>-{formatCurrency(sale.discount_amount)}</span>
                    </div>
                )}
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                    <span>TOTAL:</span>
                    <span>{formatCurrency(sale.net_amount)}</span>
                </div>
                <div>
                    <span>Payment Method:</span>
                    <span className="capitalize">{sale.payment_method}</span>
                </div>
                {sale.reference_number &&
                    String(sale.reference_number).trim() !== "" && (
                        <div>
                            <span>Reference #:</span>
                            <span>{sale.reference_number}</span>
                        </div>
                    )}
            </div>

            <div className="footer">
                <p style={{ fontSize: "12px", fontWeight: "bold" }}>
                    Thank You!
                </p>
                <p>This serves as your official sales invoice.</p>
            </div>
        </>
    );
}
