<?php

namespace App\Http\Controllers;

use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockOut;
use App\Models\StockOutItem;
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

class StockOutController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'transaction_subtype' => ['required', 'string', Rule::in([
                'Dispensed to patient',
                'Internal use / consumption',
                'Expired — write off',
                'Damaged / lost',
                'Returned to supplier',
            ])],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'patient_reference' => ['nullable', 'string', 'max:255'],
            'issued_by' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'delivered_to' => ['nullable', 'string', 'max:255'],
            'delivered_to_address' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.pd_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.lot_number' => ['required', 'string', 'max:100'],
            'items.*.quantity_deducted' => ['required', 'integer', 'min:1'],
            'items.*.unit_type' => ['required', 'string', Rule::in(['piece', 'box'])],
        ]);

        if ((int) $validated['branch_id'] !== $branchId) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'The source branch does not match your session branch.');
        }

        try {
            DB::transaction(function () use ($validated, $branchId) {
                $stockOut = StockOut::create([
                    'transaction_subtype' => $validated['transaction_subtype'],
                    'branch_id' => $branchId,
                    'patient_reference' => $validated['patient_reference'] ?? null,
                    'issued_by' => $validated['issued_by'],
                    'remarks' => $validated['remarks'] ?? null,
                    'delivered_to' => $validated['delivered_to'] ?? null,
                    'delivered_to_address' => $validated['delivered_to_address'] ?? null,
                ]);

                foreach ($validated['items'] as $item) {
                    $medicine = MedicineProduct::query()
                        ->active()
                        ->forBranch($branchId)
                        ->findOrFail($item['pd_id']);

                    $batch = ProductQty::query()
                        ->where('product_id', $medicine->id)
                        ->where('lot_number', $item['lot_number'])
                        ->lockForUpdate()
                        ->first();

                    if (! $batch || $item['quantity_deducted'] > $batch->quantity) {
                        throw new \RuntimeException('Qty exceeds lot stock. Reduce or select another lot.');
                    }

                    $batch->decrement('quantity', $item['quantity_deducted']);

                    InventoryStockService::afterBatchQuantityChange($batch->fresh());

                    StockOutItem::create([
                        'stock_out_id' => $stockOut->stock_out_id,
                        'pd_id' => $medicine->id,
                        'lot_number' => $item['lot_number'],
                        'quantity_deducted' => $item['quantity_deducted'],
                        'expiry' => $batch->expiry,
                        'unit_type' => $item['unit_type'],
                    ]);

                    InventoryMovementLogger::log(
                        branchId: $branchId,
                        movementType: InventoryMovementLog::TYPE_STOCK_OUT,
                        referenceLabel: "Stock Out #{$stockOut->stock_out_id}",
                        referenceId: $stockOut->stock_out_id,
                        pdId: $medicine->id,
                        medicineName: $medicine->med_name,
                        lotNumber: $item['lot_number'],
                        quantity: -$item['quantity_deducted'],
                        remarks: $validated['remarks'] ?? $validated['transaction_subtype'],
                    );
                }
            });
        } catch (\RuntimeException $exception) {
            return redirect()->back()
                ->withInput()
                ->with('error', $exception->getMessage());
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->back()
                ->withInput()
                ->with('error', 'Stock-out could not be saved. Please verify your entries and try again.');
        }

        return redirect()->back()
            ->with('success', 'Stock-out transaction recorded successfully.');
    }

    public function show(StockOut $stockOut): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $stockOut->branch_id !== $branchId) {
            abort(403, 'You do not have access to this stock-out transaction.');
        }

        $stockOut->load([
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'stock_out_id',
                    'pd_id',
                    'lot_number',
                    'quantity_deducted',
                    'expiry',
                    'unit_type',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form',
        ]);

        return response()->json([
            'stock_out' => [
                'stock_out_id' => $stockOut->stock_out_id,
                'transaction_subtype' => $stockOut->transaction_subtype,
                'patient_reference' => $stockOut->patient_reference,
                'issued_by' => $stockOut->issued_by,
                'remarks' => $stockOut->remarks,
                'delivered_to' => $stockOut->delivered_to,
                'delivered_to_address' => $stockOut->delivered_to_address,
                'created_at' => $stockOut->created_at,
            ],
            'items' => $stockOut->items->map(function (StockOutItem $item) {
                return [
                    'item_id' => $item->item_id,
                    'lot_number' => $item->lot_number,
                    'quantity_deducted' => $item->quantity_deducted,
                    'expiry' => $item->expiry,
                    'unit_type' => $item->unit_type,
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

    public function receipt(StockOut $stockOut): Response
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $stockOut->branch_id !== $branchId) {
            abort(403, 'You do not have access to this stock-out transaction.');
        }

        $stockOut->load([
            'branch',
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'stock_out_id',
                    'pd_id',
                    'lot_number',
                    'quantity_deducted',
                    'expiry',
                    'unit_type',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form,retail_price,wholesale_price',
        ]);

        return Inertia::render('MedicineInventory/StockOutReceipt', [
            'stockOut' => $stockOut,
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
