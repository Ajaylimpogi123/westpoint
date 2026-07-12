import React, { useEffect } from "react";
import { Head } from "@inertiajs/react";

export default function ReceiptPrint({ sale }) {
    useEffect(() => {
        window.print();
    }, []);

    const formatDate = (date) => {
        if (!date) return "";
        return new Date(date).toLocaleString("en-PH", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatCurrency = (amount) =>
        `₱${Number(amount || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const customerName =
        sale.customer_name && String(sale.customer_name).trim() !== ""
            ? sale.customer_name
            : "Walk-in";

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
            <Head title={`Receipt #${sale.invoice_number}`} />

            <style>{`
                @media print {
                    body {
                        font-family: 'Courier New', monospace;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 10px;
                        font-size: 12px;
                    }
                }
                body {
                    font-family: 'Courier New', monospace;
                    width: 80mm;
                    margin: 0 auto;
                    padding: 10px;
                    font-size: 12px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }
                .header h1 {
                    font-size: 18px;
                    margin: 0;
                }
                .header p {
                    margin: 5px 0;
                }
                .order-info {
                    margin-bottom: 15px;
                }
                .order-info div {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                th, td {
                    padding: 5px 0;
                    text-align: left;
                }
                th {
                    border-bottom: 1px solid #000;
                }
                .totals {
                    border-top: 1px solid #000;
                    margin-top: 10px;
                    padding-top: 10px;
                }
                .totals div {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    border-top: 1px dashed #000;
                    padding-top: 10px;
                }
            `}</style>

            <div className="header">
                <h1>WESTPOINT PHARMACY</h1>
                <p>Retail &amp; Wholesale Pharmacy</p>
            </div>

            <div className="order-info">
                <div>
                    <span>Invoice #:</span>
                    <strong>{sale.invoice_number}</strong>
                </div>
                <div>
                    <span>Date:</span>
                    <strong>{formatDate(sale.created_at)}</strong>
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
                        <th>Unit</th>
                        <th>Qty</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items && sale.items.length > 0 ? (
                        sale.items.map((item) => (
                            <tr key={item.id}>
                                <td>{productLabel(item.product)}</td>
                                <td>{item.unit_type}</td>
                                <td>{item.quantity_sold}</td>
                                <td>{formatCurrency(item.total_price)}</td>
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
                <div style={{ fontWeight: "bold", fontSize: "16px" }}>
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
                <div
                    style={{
                        fontSize: "14px",
                        fontWeight: "bold",
                        margin: "10px 0",
                    }}
                >
                    Thank You!
                </div>
                <p>Please come again</p>
            </div>
        </>
    );
}
