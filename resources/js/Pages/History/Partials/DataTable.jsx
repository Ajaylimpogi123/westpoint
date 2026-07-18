import React, { useState, useMemo, useCallback, useRef } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
} from "@tanstack/react-table";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { formatDate, formatDateTime } from "@/lib/dates";
import { CalendarIcon, Download, FileSpreadsheet, FileText, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function DataTable({ columns, data }) {
    const [sorting, setSorting] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]);
    const [dateRange, setDateRange] = useState(undefined);
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
    const tableRef = useRef(null);

    // Get unique payment methods from data
    const paymentMethods = useMemo(() => {
        const methods = new Set();
        data.forEach((item) => {
            if (item.payment_method) {
                methods.add(item.payment_method);
            }
        });
        return Array.from(methods).sort();
    }, [data]);

    // Memoize the date and payment filtering logic for maximum performance
    const filteredData = useMemo(() => {
        let result = [...data];
        
        // Apply date filter
        if (dateRange?.from) {
            let startDate, endDate;
            
            if (dateRange.from && !dateRange.to) {
                startDate = startOfDay(dateRange.from);
                endDate = endOfDay(dateRange.from);
            } else {
                startDate = startOfDay(dateRange.from);
                endDate = endOfDay(dateRange.to);
            }
            
            result = result.filter((item) => {
                const itemDate = item.created_at;
                if (!itemDate) return false;
                
                const date = parseISO(itemDate);
                return date >= startDate && date <= endDate;
            });
        }
        
        // Apply payment method filter
        if (paymentMethodFilter !== "all") {
            result = result.filter((item) => {
                return item.payment_method === paymentMethodFilter;
            });
        }
        
        return result;
    }, [data, dateRange, paymentMethodFilter]);

    // Calculate totals
    const totals = useMemo(() => {
        const totalAmount = filteredData.reduce((sum, item) => {
            return sum + (parseFloat(item.net_amount) || 0);
        }, 0);

        const paymentCounts = filteredData.reduce((acc, item) => {
            const payment = item.payment_method || 'unknown';
            acc[payment] = (acc[payment] || 0) + 1;
            return acc;
        }, {});

        return {
            totalAmount: totalAmount.toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            paymentCounts,
            totalTransactions: filteredData.length,
        };
    }, [filteredData]);

    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        state: {
            sorting,
            columnFilters,
        },
    });

    // Memoize the clear filters handler
    const handleClearFilters = useCallback(() => {
        setDateRange(undefined);
        setPaymentMethodFilter("all");
        table.getColumn("invoice_number")?.setFilterValue("");
    }, [table]);

    // Get active filter count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (dateRange?.from) count++;
        if (paymentMethodFilter !== "all") count++;
        if (table.getColumn("invoice_number")?.getFilterValue()) count++;
        return count;
    }, [dateRange, paymentMethodFilter, table]);

    // Export to Excel
    const exportToExcel = useCallback(() => {
        // Prepare data for export
        const exportData = filteredData.map((row) => {
            const exportRow = {};
            columns.forEach((column) => {
                if (column.accessorKey) {
                    let value = row[column.accessorKey];
                    // Format date if it's a date field
                    if (column.accessorKey === 'created_at' && value) {
                        value = formatDateTime(value, "");
                    }
                    exportRow[column.header || column.accessorKey] = value;
                }
            });
            return exportRow;
        });

        // Add totals row to export
        const totalsRow = {};
        columns.forEach((column) => {
            if (column.accessorKey) {
                if (column.accessorKey === 'net_amount') {
                    totalsRow[column.header || column.accessorKey] = `Total: ${totals.totalAmount}`;
                } else if (column.accessorKey === 'payment_method') {
                    const paymentSummary = Object.entries(totals.paymentCounts)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ');
                    totalsRow[column.header || column.accessorKey] = paymentSummary;
                } else if (column.accessorKey === 'invoice_number') {
                    totalsRow[column.header || column.accessorKey] = `Total Transactions: ${totals.totalTransactions}`;
                } else {
                    totalsRow[column.header || column.accessorKey] = '';
                }
            }
        });
        exportData.push(totalsRow);

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Auto-size columns
        const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
            wch: Math.max(key.length, ...exportData.map(row => String(row[key] || "").length))
        }));
        ws['!cols'] = colWidths;

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Export");

        // Generate filename with current date
        const fileName = `data_export_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.xlsx`;
        
        // Save file
        XLSX.writeFile(wb, fileName);
    }, [filteredData, columns, totals]);

    // Export to PDF
    const exportToPDF = useCallback(() => {
        // Create PDF document
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        
        // Prepare table columns
        const tableColumns = columns
            .filter(col => col.accessorKey) // Only include columns with accessorKey
            .map(col => col.header || col.accessorKey);
        
        // Prepare table rows
        const tableRows = filteredData.map((row) => {
            return columns
                .filter(col => col.accessorKey)
                .map((col) => {
                    let value = row[col.accessorKey];
                    // Format date if it's a date field
                    if (col.accessorKey === 'created_at' && value) {
                        value = formatDateTime(value, "");
                    }
                    return value || "";
                });
        });

        // Add totals row
        const totalsRow = columns
            .filter(col => col.accessorKey)
            .map((col) => {
                if (col.accessorKey === 'net_amount') {
                    return `Total: ${totals.totalAmount}`;
                } else if (col.accessorKey === 'payment_method') {
                    const paymentSummary = Object.entries(totals.paymentCounts)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ');
                    return paymentSummary;
                } else if (col.accessorKey === 'invoice_number') {
                    return `Total Transactions: ${totals.totalTransactions}`;
                } else {
                    return "";
                }
            });
        
        tableRows.push(totalsRow);

        // Add title
        doc.setFontSize(16);
        doc.text("Data Export Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${formatDateTime(new Date(), "")}`, 14, 22);
        
        // Add filter info if filters are applied
        let filterY = 28;
        if (dateRange?.from) {
            doc.setFontSize(9);
            const filterText = dateRange.to 
                ? `Date Filter: ${formatDate(dateRange.from, "")} - ${formatDate(dateRange.to, "")}`
                : `Date Filter: ${formatDate(dateRange.from, "")}`;
            doc.text(filterText, 14, filterY);
            filterY += 5;
        }
        
        if (paymentMethodFilter !== "all") {
            doc.setFontSize(9);
            doc.text(`Payment Filter: ${paymentMethodFilter}`, 14, filterY);
            filterY += 5;
        }

        // Add summary info
        doc.setFontSize(10);
        const startY = filterY > 28 ? filterY + 2 : 30;
        doc.text(`Total Transactions: ${totals.totalTransactions}`, 14, startY);
        doc.text(`Total Amount: ₱${totals.totalAmount}`, 14, startY + 5);

        // Add table
        autoTable(doc, {
            head: [tableColumns],
            body: tableRows,
            startY: startY + 10,
            theme: 'striped',
            styles: {
                fontSize: 8,
                cellPadding: 2,
                overflow: 'linebreak',
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240],
            },
            bodyStyles: {
                textColor: [0, 0, 0],
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
            },
            margin: { top: 10, left: 10, right: 10 },
            didDrawCell: (data) => {
                // Highlight the totals row
                if (data.row.index === tableRows.length - 1) {
                    doc.setFillColor(220, 220, 220);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    doc.setTextColor(0, 0, 0);
                }
            },
        });

        // Generate filename with current date
        const fileName = `data_export_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.pdf`;
        
        // Save PDF
        doc.save(fileName);
    }, [filteredData, columns, dateRange, paymentMethodFilter, totals]);

    // Export to CSV
    const exportToCSV = useCallback(() => {
        // Prepare headers
        const headers = columns
            .filter(col => col.accessorKey)
            .map(col => col.header || col.accessorKey);
        
        // Prepare rows
        const rows = filteredData.map((row) => {
            return columns
                .filter(col => col.accessorKey)
                .map((col) => {
                    let value = row[col.accessorKey];
                    // Format date if it's a date field
                    if (col.accessorKey === 'created_at' && value) {
                        value = formatDateTime(value, "");
                    }
                    // Handle commas and quotes for CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        value = `"${value.replace(/"/g, '""')}"`;
                    }
                    return value || "";
                });
        });

        // Add totals row
        const totalsRow = columns
            .filter(col => col.accessorKey)
            .map((col) => {
                if (col.accessorKey === 'net_amount') {
                    return `Total: ${totals.totalAmount}`;
                } else if (col.accessorKey === 'payment_method') {
                    const paymentSummary = Object.entries(totals.paymentCounts)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ');
                    return paymentSummary;
                } else if (col.accessorKey === 'invoice_number') {
                    return `Total Transactions: ${totals.totalTransactions}`;
                } else {
                    return "";
                }
            });

        rows.push(totalsRow);

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Add BOM for UTF-8 support
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        
        // Generate filename with current date
        const fileName = `data_export_${format(new Date(), "yyyy-MM-dd_HH-mm-ss")}.csv`;
        
        // Save file
        saveAs(blob, fileName);
    }, [filteredData, columns, totals]);

    return (
        <div className="space-y-4">
            {/* Filters and Actions Row */}
            <div className="flex gap-4 items-end flex-wrap justify-between">
                <div className="flex gap-4 items-end flex-wrap flex-1">
                    {/* Invoice Number Filter */}
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            placeholder="Filter by Invoice Number..."
                            value={table.getColumn("invoice_number")?.getFilterValue() || ""}
                            onChange={(e) =>
                                table.getColumn("invoice_number")?.setFilterValue(e.target.value)
                            }
                            className="max-w-sm"
                        />
                    </div>

                    {/* Payment Method Filter Dropdown */}
                    <div className="grid gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    className={cn(
                                        "w-[180px] justify-start gap-2",
                                        paymentMethodFilter !== "all" && "bg-blue-50 border-blue-300"
                                    )}
                                >
                                    <Filter className="h-4 w-4" />
                                    {paymentMethodFilter === "all" ? "All Payments" : paymentMethodFilter}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[180px]">
                                <DropdownMenuItem 
                                    onClick={() => setPaymentMethodFilter("all")}
                                    className={cn(
                                        "cursor-pointer",
                                        paymentMethodFilter === "all" && "bg-blue-50 text-blue-600"
                                    )}
                                >
                                    All Payments
                                </DropdownMenuItem>
                                {paymentMethods.map((method) => (
                                    <DropdownMenuItem 
                                        key={method}
                                        onClick={() => setPaymentMethodFilter(method)}
                                        className={cn(
                                            "cursor-pointer capitalize",
                                            paymentMethodFilter === method && "bg-blue-50 text-blue-600"
                                        )}
                                    >
                                        {method}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Date Range Picker */}
                    <div className="grid gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-[300px] justify-start text-left font-normal",
                                        !dateRange?.from && "text-muted-foreground",
                                        dateRange?.from && "bg-blue-50 border-blue-300"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {formatDate(dateRange.from, "")} -{" "}
                                                {formatDate(dateRange.to, "")}
                                            </>
                                        ) : (
                                            formatDate(dateRange.from, "")
                                        )
                                    ) : (
                                        <span>Filter by created date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Clear Filters Button */}
                    {activeFiltersCount > 0 && (
                        <Button
                            variant="ghost"
                            onClick={handleClearFilters}
                            className="gap-2"
                        >
                            Clear Filters ({activeFiltersCount})
                        </Button>
                    )}
                </div>

                {/* Export Dropdown Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Download className="h-4 w-4" />
                            Export
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                            Export to Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                            Export to CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                            <FileText className="h-4 w-4 text-red-600" />
                            Export to PDF
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">Total Transactions</div>
                    <div className="text-2xl font-bold">{totals.totalTransactions}</div>
                </div>
                <div className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">Total Amount</div>
                    <div className="text-2xl font-bold text-green-600">₱{totals.totalAmount}</div>
                </div>
                <div className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="text-sm text-gray-500 mb-1">Payment Methods</div>
                    <div className="text-sm font-medium space-y-1">
                        {Object.entries(totals.paymentCounts).map(([type, count]) => (
                            <div key={type} className="capitalize flex justify-between">
                                <span>{type}:</span>
                                <span className="font-bold">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border" ref={tableRef}>
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        className="text-gray-600"
                                        key={header.id}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>

                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>

                    {/* Table Footer with Totals */}
                    {table.getRowModel().rows.length > 0 && (
                        <TableFooter>
                            <TableRow className="bg-gray-50 font-medium">
                                <TableCell colSpan={columns.length - 3} className="text-right font-bold">
                                    Total:
                                </TableCell>
                                <TableCell className="font-bold text-green-600">
                                    ₱{totals.totalAmount}
                                </TableCell>
                                <TableCell className="font-bold">
                                    {/* Payment summary in footer */}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Showing {table.getRowModel().rows.length} of {filteredData.length} results
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}