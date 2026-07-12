<?php

namespace App\Http\Controllers;

use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrderHistoryController extends Controller
{
    public function index(Request $request): Response
    {
        $branchId = session('branch_id');

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        $sales = Sale::query()
            ->where('branch_id', $branchId)
            ->orderByDesc('created_at')
            ->get([
                'id',
                'invoice_number',
                'created_at',
                'customer_name',
                'gross_amount',
                'discount_amount',
                'net_amount',
                'payment_method',
                'reference_number',
            ]);

        return Inertia::render('History/Index', [
            'sales' => $sales,
        ]);
    }

    public function show(Sale $sale): JsonResponse
    {
        $this->assertBranchAccess($sale);

        $sale->load([
            'items' => function ($query) {
                $query->select([
                    'id',
                    'sale_id',
                    'product_id',
                    'unit_type',
                    'quantity_sold',
                    'price_used',
                    'total_price',
                ]);
            },
            'items.product:id,med_name,dose,form,brand_name',
        ]);

        return response()->json([
            'sale' => [
                'id' => $sale->id,
                'invoice_number' => $sale->invoice_number,
                'created_at' => $sale->created_at,
                'customer_name' => $sale->customer_name,
                'gross_amount' => $sale->gross_amount,
                'discount_amount' => $sale->discount_amount,
                'net_amount' => $sale->net_amount,
                'payment_method' => $sale->payment_method,
                'reference_number' => $sale->reference_number,
            ],
            'items' => $sale->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'unit_type' => $item->unit_type,
                    'quantity_sold' => $item->quantity_sold,
                    'price_used' => $item->price_used,
                    'total_price' => $item->total_price,
                    'product' => $item->product ? [
                        'med_name' => $item->product->med_name,
                        'dose' => $item->product->dose,
                        'form' => $item->product->form,
                        'brand_name' => $item->product->brand_name,
                    ] : null,
                ];
            })->values(),
        ]);
    }

    public function print(Sale $sale): Response
    {
        $this->assertBranchAccess($sale);

        $sale->load([
            'items' => function ($query) {
                $query->select([
                    'id',
                    'sale_id',
                    'product_id',
                    'unit_type',
                    'quantity_sold',
                    'price_used',
                    'total_price',
                ]);
            },
            'items.product:id,med_name,dose,form,brand_name',
        ]);

        return Inertia::render('History/Partials/ReceiptPrint', [
            'sale' => $sale,
        ]);
    }

    private function assertBranchAccess(Sale $sale): void
    {
        $branchId = session('branch_id');

        if (! $branchId || (int) $sale->branch_id !== (int) $branchId) {
            abort(403, 'Sale is not accessible in your branch session.');
        }
    }
}
