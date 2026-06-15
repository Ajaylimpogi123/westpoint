import React from 'react';
import { motion, AnimatePresence } from "framer-motion";

export default function LoadingOverlay({ isVisible, message = "Processing your order..." }) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="bg-white rounded-2xl p-8 max-w-sm mx-4 shadow-2xl"
                    >
                        <div className="flex flex-col items-center">
                            {/* Spinner */}
                            <div className="relative w-24 h-24 mb-4">
                                {/* Outer ring */}
                                <div className="absolute inset-0 border-4 border-green-200 rounded-full"></div>
                                {/* Spinning ring */}
                                <div className="absolute inset-0 border-4 border-green-600 rounded-full border-t-transparent animate-spin"></div>
                                {/* Check icon in center */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg 
                                        className="w-10 h-10 text-green-600" 
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
                                </div>
                            </div>
                            
                            {/* Loading text */}
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {message}
                            </h3>
                            
                            {/* Progress dots */}
                            <div className="flex gap-2 mt-4">
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                                    className="w-2 h-2 bg-green-600 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                                    className="w-2 h-2 bg-green-600 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                                    className="w-2 h-2 bg-green-600 rounded-full"
                                />
                            </div>

                            {/* Optional progress message */}
                            <p className="text-sm text-gray-500 mt-4 text-center">
                                Please wait while we process your order
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}