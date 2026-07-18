<?php

namespace App\Http\Controllers;

use App\Models\MedicineProduct;
use App\Models\StockIn;
use App\Models\StockInItem;
use App\Models\InventoryMovementLog;
use App\Services\InventoryMovementLogger;
use App\Services\InventoryStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StockInController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'supplier_name' => ['required', 'string', 'max:255'],
            'delivery_date' => ['required', 'date'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'received_by' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.pd_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.batch_number' => ['required', 'string', 'max:100'],
            'items.*.expiry_date' => ['required', 'date'],
            'items.*.quantity_received' => ['required', 'integer', 'min:1'],
            'items.*.shelf_number' => ['nullable', 'string', 'max:50'],
            'items.*.unit_type' => ['required', 'string', Rule::in(['Piece', 'Box'])],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
        ]);

        if ((int) $validated['branch_id'] !== $branchId) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'The destination branch does not match your session branch.');
        }

        try {
            DB::transaction(function () use ($validated, $branchId) {
                $stockIn = StockIn::create([
                    'supplier_name' => $validated['supplier_name'],
                    'delivery_date' => $validated['delivery_date'],
                    'branch_id' => $branchId,
                    'received_by' => $validated['received_by'],
                    'remarks' => $validated['remarks'] ?? null,
                ]);

                foreach ($validated['items'] as $item) {
                    $medicine = MedicineProduct::query()
                        ->active()
                        ->forBranch($branchId)
                        ->findOrFail($item['pd_id']);

                    StockInItem::create([
                        'stock_in_id' => $stockIn->stock_in_id,
                        'pd_id' => $medicine->id,
                        'batch_number' => $item['batch_number'],
                        'expiry_date' => $item['expiry_date'],
                        'quantity_received' => $item['quantity_received'],
                        'unit_type' => $item['unit_type'],
                        'unit_price' => $item['unit_price'],
                    ]);

                    InventoryStockService::addStock(
                        productId: $medicine->id,
                        branchId: $branchId,
                        quantityInPieces: $item['quantity_received'],
                        lotNumber: $item['batch_number'],
                        expiry: $item['expiry_date'],
                        shelfNumber: $item['shelf_number'] ?? null,
                    );

                    InventoryMovementLogger::log(
                        branchId: $branchId,
                        movementType: InventoryMovementLog::TYPE_STOCK_IN,
                        referenceLabel: "Stock In #{$stockIn->stock_in_id}",
                        referenceId: $stockIn->stock_in_id,
                        pdId: $medicine->id,
                        medicineName: $medicine->med_name,
                        lotNumber: $item['batch_number'],
                        quantity: $item['quantity_received'],
                        remarks: $validated['remarks'] ?? "Supplier: {$validated['supplier_name']}",
                    );
                }
            });
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->back()
                ->withInput()
                ->with('error', 'Stock-in could not be saved. Please verify your entries and try again.');
        }

        return redirect()->back()
            ->with('success', 'Stock-in transaction recorded successfully.');
    }

    public function show(StockIn $stockIn): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $stockIn->branch_id !== $branchId) {
            abort(403, 'You do not have access to this stock-in transaction.');
        }

        $stockIn->load([
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'stock_in_id',
                    'pd_id',
                    'batch_number',
                    'expiry_date',
                    'quantity_received',
                    'unit_type',
                    'unit_price',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form',
        ]);

        return response()->json([
            'stock_in' => [
                'stock_in_id' => $stockIn->stock_in_id,
                'supplier_name' => $stockIn->supplier_name,
                'delivery_date' => $stockIn->delivery_date,
                'received_by' => $stockIn->received_by,
                'remarks' => $stockIn->remarks,
                'created_at' => $stockIn->created_at,
            ],
            'items' => $stockIn->items->map(function (StockInItem $item) {
                return [
                    'item_id' => $item->item_id,
                    'batch_number' => $item->batch_number,
                    'expiry_date' => $item->expiry_date,
                    'quantity_received' => $item->quantity_received,
                    'unit_type' => $item->unit_type,
                    'unit_price' => $item->unit_price,
                    'product' => $item->product ? [
                        'med_name' => $item->product->med_name,
                        'brand_name' => $item->product->brand_name,
                        'dose' => $item->product->dose,
                        'form' => $item->product->form,
                    ] : null,
                ];
            }),
        ]);
    }

    public function receipt(StockIn $stockIn): Response
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $stockIn->branch_id !== $branchId) {
            abort(403, 'You do not have access to this stock-in transaction.');
        }

        $stockIn->load([
            'branch',
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'stock_in_id',
                    'pd_id',
                    'batch_number',
                    'expiry_date',
                    'quantity_received',
                    'unit_type',
                    'unit_price',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form,retail_price,wholesale_price',
        ]);

        return Inertia::render('MedicineInventory/StockInReceipt', [
            'stockIn' => $stockIn,
        ]);
    }

    private function branchIdOrFail(): int
    {
        $branchId = session('branch_id');

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return (int) $branchId;
    }
}
