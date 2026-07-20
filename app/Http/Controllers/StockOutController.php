<?php

namespace App\Http\Controllers;

use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
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

                $saleLineItems = [];

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

                    if ($validated['transaction_subtype'] === 'Dispensed to patient') {
                        $priceUsed = $item['unit_type'] === 'box'
                            ? (float) $medicine->wholesale_price
                            : (float) $medicine->retail_price;

                        $saleLineItems[] = [
                            'product_id' => $medicine->id,
                            'products_qty_id' => $batch->id,
                            'unit_type' => $item['unit_type'] === 'box' ? 'Box' : 'Piece',
                            'quantity_sold' => $item['quantity_deducted'],
                            'price_used' => $priceUsed,
                            'total_price' => round($priceUsed * $item['quantity_deducted'], 2),
                        ];
                    }
                }

                if ($saleLineItems !== []) {
                    $this->recordDispenseAsSale($stockOut, $validated, $branchId, $saleLineItems);
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

    /**
     * @param  array<int, array{
     *     product_id: int,
     *     products_qty_id: int,
     *     unit_type: string,
     *     quantity_sold: int,
     *     price_used: float,
     *     total_price: float
     * }>  $saleLineItems
     */
    private function recordDispenseAsSale(
        StockOut $stockOut,
        array $validated,
        int $branchId,
        array $saleLineItems
    ): void {
        $grossAmount = round(array_sum(array_column($saleLineItems, 'total_price')), 2);

        $customerName = $validated['patient_reference'] ?? $validated['delivered_to'] ?? null;
        $customerName = $customerName !== null ? trim($customerName) : null;

        $sale = Sale::create([
            'invoice_number' => $this->generateDispenseInvoiceNumber($stockOut->stock_out_id),
            'branch_id' => $branchId,
            'user_id' => auth()->id(),
            'customer_name' => $customerName !== '' ? $customerName : null,
            'customer_id' => null,
            'gross_amount' => $grossAmount,
            'discount_amount' => 0,
            'net_amount' => $grossAmount,
            'payment_method' => 'Dispensed to patient',
            'reference_number' => "Stock Out #{$stockOut->stock_out_id}",
        ]);

        foreach ($saleLineItems as $lineItem) {
            SaleItem::create([
                'sale_id' => $sale->id,
                'product_id' => $lineItem['product_id'],
                'products_qty_id' => $lineItem['products_qty_id'],
                'unit_type' => $lineItem['unit_type'],
                'quantity_sold' => $lineItem['quantity_sold'],
                'price_used' => $lineItem['price_used'],
                'total_price' => $lineItem['total_price'],
            ]);
        }
    }

    private function generateDispenseInvoiceNumber(int $stockOutId): string
    {
        return 'DISP-' . date('Ymd') . '-' . str_pad((string) $stockOutId, 5, '0', STR_PAD_LEFT);
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
