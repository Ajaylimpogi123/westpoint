import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/Components/ui/button";
import { Printer, X } from "lucide-react";
import { formatDateTime } from "@/lib/dates";

export default function SuccessModal({ isVisible, order, onClose, onPrint }) {
    if (!isVisible || !order) return null;

    // Format currency
    const formatCurrency = (amount) => {
        return `₱${parseFloat(amount).toFixed(2)}`;
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.5 }}
                        className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                    >
                        {/* Close button */}
                        <div className="flex justify-end">
                            <button 
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Success Icon */}
                        <div className="text-center mb-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="inline-flex p-3 bg-green-100 rounded-full mb-4"
                            >
                                <svg 
                                    className="w-12 h-12 text-green-600" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    stroke="currentColor"
                                >
                                    <path 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth={2} 
                                        d="M5 13l4 4L19 7" 
                                    />
                                </svg>
                            </motion.div>
                            
                            <motion.h3 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-2xl font-bold text-gray-900 mb-2"
                            >
                                Order Placed Successfully!
                            </motion.h3>
                            
                            <motion.p 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-gray-500"
                            >
                                Invoice #{order.invoice_no || 'N/A'}
                            </motion.p>
                        </div>

                        {/* Order Details */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Date:</span>
                                <span className="font-medium text-gray-900">
                                    {formatDateTime(order.od_date, "")}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Table:</span>
                                <span className="font-bold text-gray-900">
                                    Table {order.table_number}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Payment Method:</span>
                                <span className="font-medium capitalize text-gray-900">
                                    {order.payment_method}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Items:</span>
                                <span className="font-medium text-gray-900">
                                    {order.items?.length || 0} items
                                </span>
                            </div>
                            
                            <div className="border-t border-gray-200 my-2 pt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-800 font-medium">Subtotal:</span>
                                    <span className="text-gray-900">
                                        {formatCurrency(order.od_amount_due)}
                                    </span>
                                </div>
                                
                                {order.od_discount > 0 && (
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-gray-800 font-medium">Discount:</span>
                                        <span className="text-red-500">
                                            -{formatCurrency(order.od_discount)}
                                        </span>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                                    <span className="text-lg font-bold text-gray-900">Total:</span>
                                    <span className="text-xl font-bold text-green-600">
                                        {formatCurrency(order.od_total_amt_due)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Action Buttons */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex gap-3"
                        >
                            <Button
                                onClick={onPrint}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition-all hover:shadow-lg"
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                Print Receipt
                            </Button>
                            
                            <Button
                                onClick={onClose}
                                variant="outline"
                                className="flex-1 py-3 rounded-xl border-2 hover:bg-gray-50 transition-all"
                            >
                                Continue Ordering
                            </Button>
                        </motion.div>

                        {/* Thank you message */}
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                            className="text-center text-xs text-gray-400 mt-4"
                        >
                            Thank you for your order!
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}