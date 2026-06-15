import React, { useEffect } from 'react';
import { Head } from '@inertiajs/react';

export default function ReceiptPrint({ order }) {
    useEffect(() => {
        console.log("ReceiptPrint component mounted", order);
        // Auto print when component mounts
        window.print();
    }, []);

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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
                <h1>YOUR RESTAURANT NAME</h1>
                <p>123 Food Street, City</p>
                <p>Tel: (123) 456-7890</p>
            </div>

            <div className="order-info">
                <div><span>Invoice #:</span><strong>{order.invoice_no}</strong></div>
                {/* <div><span>Date:</span><strong>{formatDate(order.od_date)}</strong></div> */}
                <div><span>Table:</span><strong>{order.table_number}</strong></div>
                <div><span>Cashier:</span><strong>Staff</strong></div>
                <div><span>Customer:</span><strong>{customerName}</strong></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {order.items && order.items.length > 0 ? (
                        order.items.map((item) => (
                            <tr key={item.oid_id}>
                                <td>{item.product?.pd_name || 'Product'}</td>
                                <td>{item.oi_qty}</td>
                                <td>{formatCurrency(item.oi_price)}</td>
                                <td>{formatCurrency(item.oi_qty * item.oi_price)}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="4" style={{textAlign: 'center'}}>No items found</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="totals">
                <div><span>Subtotal:</span><span>{formatCurrency(order.od_amount_due)}</span></div>
                {parseFloat(order.od_discount) > 0 && (
                    <div><span>Discount:</span><span>-{formatCurrency(order.od_discount)}</span></div>
                )}
                <div style={{fontWeight:'bold', fontSize:'16px'}}>
                    <span>TOTAL:</span>
                    <span>{formatCurrency(order.od_total_amt_due)}</span>
                </div>
                <div><span>Payment Method:</span><span className="capitalize">{order.payment_method}</span></div>
                <div><span>Amount Paid:</span><span>{formatCurrency(order.od_payment)}</span></div>
                <div><span>Change:</span><span>{formatCurrency(order.od_change)}</span></div>
            </div>

            <div className="footer">
                <div style={{fontSize:'14px', fontWeight:'bold', margin:'10px 0'}}>Thank You!</div>
                <p>Please come again</p>
                <p style={{fontSize:'8px', marginTop:'10px'}}>Powered by Your POS System</p>
            </div>
        </>
    );
}