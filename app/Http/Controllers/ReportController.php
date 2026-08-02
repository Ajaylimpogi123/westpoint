<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * Back-office reports landing page — menu of available reports.
     */
    public function index()
    {
        return Inertia::render('Reports/Index');
    }

    /**
     * Shared branch list for filter dropdowns, pulled once per request.
     */
    protected function branchOptions()
    {
        return Branch::select('id', 'branch_name')->orderBy('branch_name')->get();
    }

    public function salesSummary(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id', 'payment_method']);

        return Inertia::render('Reports/SalesSummary', [
            'filters' => $filters,
            'data' => Report::salesSummary($filters),
            'branches' => $this->branchOptions(),
            'paymentMethods' => DB::table('tbl_sales')->distinct()->pluck('payment_method')->filter()->values(),
        ]);
    }

    public function salesDetail(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id', 'user_id', 'payment_method', 'per_page']);

        return Inertia::render('Reports/SalesDetail', [
            'filters' => $filters,
            'sales' => Report::salesDetail($filters),
            'branches' => $this->branchOptions(),
            'paymentMethods' => DB::table('tbl_sales')->distinct()->pluck('payment_method')->filter()->values(),
        ]);
    }

    public function topProducts(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id']);

        return Inertia::render('Reports/TopProducts', [
            'filters' => $filters,
            'products' => Report::topProducts($filters, (int) $request->input('limit', 20)),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function salesByCashier(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id']);

        return Inertia::render('Reports/SalesByCashier', [
            'filters' => $filters,
            'cashiers' => Report::salesByCashier($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function stockOnHand(Request $request)
    {
        $filters = $request->only([
            'branch_id', 'product_id', 'brand_name', 'lot_number', 'shelf_number', 'expiry_from', 'expiry_to',
        ]);

        return Inertia::render('Reports/StockOnHand', [
            'filters' => $filters,
            'stock' => Report::stockOnHand($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function lowStock(Request $request)
    {
        $filters = $request->only(['branch_id']);

        return Inertia::render('Reports/LowStock', [
            'filters' => $filters,
            'products' => Report::lowStock($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function expiry(Request $request)
    {
        $filters = $request->only(['branch_id', 'within_days']);

        return Inertia::render('Reports/Expiry', [
            'filters' => $filters,
            'batches' => Report::expiry($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function stockIn(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id']);

        return Inertia::render('Reports/StockIn', [
            'filters' => $filters,
            'items' => Report::stockInReport($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function stockOut(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id']);

        return Inertia::render('Reports/StockOut', [
            'filters' => $filters,
            'items' => Report::stockOutReport($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function stockTransfers(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id', 'status']);

        return Inertia::render('Reports/StockTransfers', [
            'filters' => $filters,
            'transfers' => Report::stockTransferReport($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    public function movementLedger(Request $request)
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id', 'movement_type', 'per_page']);

        return Inertia::render('Reports/MovementLedger', [
            'filters' => $filters,
            'logs' => Report::movementLedger($filters),
            'branches' => $this->branchOptions(),
        ]);
    }

    /**
     * CSV export for the sales detail report.
     * Same pattern (Report::x() + array_map header row) works for any
     * other report — duplicate this method and swap the query/columns.
     */
    public function exportSalesDetail(Request $request): StreamedResponse
    {
        $filters = $request->only(['date_from', 'date_to', 'branch_id', 'user_id']);
        $filters['per_page'] = 100000; // effectively "all" for export

        $sales = Report::salesDetail($filters);

        $filename = 'sales-detail-' . now()->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($sales) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Invoice #', 'Reference #', 'Customer', 'Payment Method',
                'Gross', 'Discount', 'Net', 'Cashier', 'Branch', 'Date',
            ]);

            foreach ($sales as $sale) {
                fputcsv($handle, [
                    $sale->invoice_number,
                    $sale->reference_number,
                    $sale->customer_name,
                    $sale->payment_method,
                    $sale->gross_amount,
                    $sale->discount_amount,
                    $sale->net_amount,
                    $sale->cashier_name,
                    $sale->branch_name,
                    $sale->created_at,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}