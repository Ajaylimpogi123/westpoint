import React from 'react';
import { Button } from "@/Components/ui/button";
import { Printer } from "lucide-react";

export default function PrintButton({ order }) {
    const handlePrint = () => {
        // Open in new window for printing
        const printWindow = window.open(
            route('order.print', order.od_id),
            '_blank',
            'width=800,height=600'
        );
        
        // Focus on the new window
        if (printWindow) {
            printWindow.focus();
        }
    };

    return (
        <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700"
        >
            <Printer className="w-4 h-4 mr-2" />
            Print Receipt
        </Button>
    );
}