import React, { useEffect } from 'react';
import { Head } from '@inertiajs/react';
import { formatDateTime } from '@/lib/dates';

export default function ReceiptPrint({ order }) {
    useEffect(() => {
        // Auto print when component mounts
        window.print();
    }, []);

    const formatCurrency = (amount) => {
        return `₱${parseFloat(amount).toFixed(2)}`;
    };

    // Safely access customer name
    const customerName = order.customer?.cust_fname || 'Walk-in Customer';

    return (
        <>
            <Head title={`Receipt #${order.invoice_no}`} />
            
            <style>{`
                @media print {
                    body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 12px; }
                }
                body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 12px; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .header h1 { font-size: 18px; margin: 0; }
                .order-info div { display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { padding: 5px 0; text-align: left; }
                th { border-bottom: 1px solid #000; }
                .totals { border-top: 1px solid #000; margin-top: 10px; padding-top: 10px; }
                .totals div { display: flex; justify-content: space-between; margin: 3px 0; }
                .footer { text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; }
            `}</style>

            <div className="header">
                <h1>YOUR RESTAURANT NAME</h1>
                <p>123 Food Street, City</p>
                <p>Tel: (123) 456-7890</p>
            </div>

            <div className="order-info">
                <div><span>Invoice #:</span><strong>{order.invoice_no}</strong></div>

                <div><span>Table:</span><strong>{order.table_number}</strong></div>
                <div><span>Customer:</span><strong>{customerName}</strong></div>
            </div>

            <table>
                <thead>
                    <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                    {order.items?.map((item) => (
                        <tr key={item.oid_id}>
                            <td>{item.product?.pd_name || 'Product'}</td>
                            {/* FIXED: Changed from oi_quantity to oi_qty to match your model */}
                            <td>{item.oi_qty}</td>
                            <td>{formatCurrency(item.oi_price)}</td>
                            {/* FIXED: Changed from oi_quantity to oi_qty */}
                            <td>{formatCurrency(item.oi_qty * item.oi_price)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="totals">
                <div><span>Subtotal:</span><span>{formatCurrency(order.od_amount_due)}</span></div>
                {order.od_discount > 0 && (
                    <div><span>Discount:</span><span>-{formatCurrency(order.od_discount)}</span></div>
                )}
                <div style={{fontWeight:'bold'}}><span>TOTAL:</span><span>{formatCurrency(order.od_total_amt_due)}</span></div>
                <div><span>Payment:</span><span className="capitalize">{order.payment_method}</span></div>
                <div><span>Amount Paid:</span><span>{formatCurrency(order.od_payment)}</span></div>
                <div><span>Change:</span><span>{formatCurrency(order.od_change)}</span></div>
            </div>

            <div className="footer">
                <div style={{fontSize:'14px', fontWeight:'bold'}}>Thank You!</div>
                <p>Please come again</p>
            </div>
        </>
    );
}