<?php

namespace App\Http\Controllers;

use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleItemAllocation;
use App\Models\SaleReturn;
use App\Models\SaleReturnItem;
use App\Services\InventoryStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
                'status',
                'refunded_amount',
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
                    'returned_quantity',
                    'price_used',
                    'total_price',
                    'discount_amount',
                    'refunded_amount',
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
                'status' => $sale->status,
                'refunded_amount' => $sale->refunded_amount,
                'payment_method' => $sale->payment_method,
                'reference_number' => $sale->reference_number,
            ],
            'items' => $sale->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'unit_type' => $item->unit_type,
                    'quantity_sold' => $item->quantity_sold,
                    'returned_quantity' => $item->returned_quantity,
                    'price_used' => $item->price_used,
                    'total_price' => $item->total_price,
                    'discount_amount' => $item->discount_amount,
                    'refunded_amount' => $item->refunded_amount,
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
                    'returned_quantity',
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

    /**
     * What can still be voided/returned for this sale, with the remaining
     * quantity per line already computed (quantity_sold minus what's
     * already been returned in earlier partial voids).
     */
    public function returnable(Sale $sale): JsonResponse
    {
        $this->assertBranchAccess($sale);

        $sale->load([
            'items.product:id,med_name,dose,form,brand_name',
        ]);

        return response()->json([
            'sale' => [
                'id' => $sale->id,
                'invoice_number' => $sale->invoice_number,
                'status' => $sale->status,
            ],
            'items' => $sale->items->map(function (SaleItem $item) {
                return [
                    'sale_item_id' => $item->id,
                    'product_name' => $item->product?->med_name,
                    'brand_name' => $item->product?->brand_name,
                    'unit_type' => $item->unit_type,
                    'quantity_sold' => $item->quantity_sold,
                    'returned_quantity' => $item->returned_quantity,
                    'remaining_quantity' => $item->remainingQuantity(),
                    'price_used' => $item->price_used,
                ];
            })->values(),
        ]);
    }

    /**
     * Void/return selected quantities of one or more lines on a sale.
     * Restocks pieces back into the exact batch(es) they were deducted
     * from, refunds the net (post-discount, VAT-as-charged) per-unit price
     * for the returned quantity, and rolls the sale's status up to
     * Completed / Partially Voided / Voided based on what's left unreturned.
     */
    public function storeVoid(Request $request, Sale $sale): RedirectResponse|JsonResponse
    {
        $this->assertBranchAccess($sale);

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => [
                'required',
                'integer',
                'exists:tbl_sales_items,id',
            ],
            'items.*.quantity_returned' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:500'],
            'received_by' => ['nullable', 'string', 'max:255'],
        ]);

        $branchId = (int) $sale->branch_id;

        try {
            DB::beginTransaction();

            $saleReturn = SaleReturn::create([
                'sale_id' => $sale->id,
                'branch_id' => $branchId,
                'processed_by' => auth()->id(),
                'received_by' => $validated['received_by'] ?? auth()->user()?->name,
                'reason' => $validated['reason'],
                'total_refund' => 0,
            ]);

            $totalRefund = 0.0;

            foreach ($validated['items'] as $requestedItem) {
                /** @var SaleItem $saleItem */
                $saleItem = SaleItem::query()
                    ->where('id', $requestedItem['sale_item_id'])
                    ->where('sale_id', $sale->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $quantityReturned = (int) $requestedItem['quantity_returned'];
                $remaining = $saleItem->remainingQuantity();

                if ($quantityReturned > $remaining) {
                    throw new \RuntimeException(
                        "Cannot return {$quantityReturned} — only {$remaining} left to return for this line."
                    );
                }

                $product = $saleItem->product;

                // Net per-unit price actually charged (post per-line discount,
                // whatever VAT treatment was applied at sale time), so the
                // refund matches what the customer actually paid per unit.
                $unitNetPrice = $saleItem->quantity_sold > 0
                    ? round(
                        ((float) $saleItem->total_price - (float) $saleItem->discount_amount)
                            / $saleItem->quantity_sold,
                        2
                    )
                    : 0.0;
                $refundAmount = round($unitNetPrice * $quantityReturned, 2);

                $piecesToRestock = $product->toPieces($quantityReturned, $saleItem->unit_type);

                $restockedBatches = $this->restockPieces($saleItem, $piecesToRestock, $branchId);

                SaleReturnItem::create([
                    'return_id' => $saleReturn->return_id,
                    'sale_item_id' => $saleItem->id,
                    'quantity_returned' => $quantityReturned,
                    'pieces_restocked' => $piecesToRestock,
                    'refund_amount' => $refundAmount,
                    'restocked_batches' => $restockedBatches,
                ]);

                $saleItem->increment('returned_quantity', $quantityReturned);
                $saleItem->increment('refunded_amount', $refundAmount);

                $totalRefund += $refundAmount;
            }

            $saleReturn->update(['total_refund' => round($totalRefund, 2)]);

            $sale->refresh();
            $sale->load('items');

            $totalRefundedAllTime = (float) $sale->items->sum('refunded_amount');
            $allFullyReturned = $sale->items->every(
                fn (SaleItem $item) => $item->remainingQuantity() === 0
            );

            $status = $allFullyReturned
                ? Sale::STATUS_VOIDED
                : ($totalRefundedAllTime > 0 ? Sale::STATUS_PARTIALLY_VOIDED : Sale::STATUS_COMPLETED);

            $sale->update([
                'refunded_amount' => round($totalRefundedAllTime, 2),
                'status' => $status,
            ]);

            DB::commit();
        } catch (\RuntimeException $e) {
            DB::rollBack();

            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            report($e);

            return response()->json([
                'message' => 'Failed to process the void/return. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Return processed and stock restocked.',
            'sale' => [
                'id' => $sale->id,
                'status' => $sale->status,
                'refunded_amount' => $sale->refunded_amount,
            ],
        ]);
    }

    /**
     * Restock pieces back into the exact batch(es) they were deducted from.
     * Single-batch lines restock directly; split-batch lines (tracked via
     * SaleItemAllocation) restock proportionally across each batch in the
     * same ratio they were originally deducted, so partial returns don't
     * over- or under-credit any one lot.
     *
     * @return array<int, array{products_qty_id: int, pieces: int}>
     */
    private function restockPieces(SaleItem $saleItem, int $piecesToRestock, int $branchId): array
    {
        $allocations = $saleItem->allocations;

        if ($allocations->isEmpty()) {
            $batchId = $this->restockIntoBatch(
                $saleItem->products_qty_id,
                $piecesToRestock,
                $saleItem->product_id,
                $branchId,
                $saleItem->product?->med_name ?? 'Returned item'
            );

            return [['products_qty_id' => $batchId, 'pieces' => $piecesToRestock]];
        }

        $totalAllocatedPieces = (int) $allocations->sum('pieces');
        $restocked = [];
        $piecesLeft = $piecesToRestock;
        $allocationCount = $allocations->count();

        foreach ($allocations as $index => $allocation) {
            $isLast = $index === $allocationCount - 1;

            $share = $isLast
                ? $piecesLeft
                : (int) floor($piecesToRestock * ($allocation->pieces / max($totalAllocatedPieces, 1)));

            $share = min($share, $piecesLeft);
            $piecesLeft -= $share;

            if ($share <= 0) {
                continue;
            }

            $batchId = $this->restockIntoBatch(
                $allocation->products_qty_id,
                $share,
                $saleItem->product_id,
                $branchId,
                $saleItem->product?->med_name ?? 'Returned item'
            );

            $restocked[] = ['products_qty_id' => $batchId, 'pieces' => $share];
        }

        return $restocked;
    }

    /**
     * Increment the original batch if it still exists; otherwise create a
     * fresh lot so a return is never silently lost because the source batch
     * was later deleted.
     */
    private function restockIntoBatch(
        ?int $originalBatchId,
        int $pieces,
        int $productId,
        int $branchId,
        string $productName
    ): int {
        $batch = $originalBatchId
            ? ProductQty::query()->where('id', $originalBatchId)->lockForUpdate()->first()
            : null;

        if ($batch) {
            $batch->increment('quantity', $pieces);

            // Restocking can bring a batch that was zeroed out (and
            // auto-marked Inactive) back above zero — reactivate it so it's
            // dispensable again, mirroring the batch-edit flow.
            if ($batch->status !== 'Active') {
                $batch->update(['status' => 'Active']);
            }

            InventoryStockService::afterBatchQuantityChange($batch);

            return $batch->id;
        }

        $newBatch = InventoryStockService::addStock(
            productId: $productId,
            branchId: $branchId,
            quantityInPieces: $pieces,
            lotNumber: 'RETURN-' . now()->format('Ymd-His'),
            expiry: null,
            shelfNumber: null,
        );

        return $newBatch->id ?? $newBatch;
    }

    private function assertBranchAccess(Sale $sale): void
    {
        $branchId = session('branch_id');

        if (! $branchId || (int) $sale->branch_id !== (int) $branchId) {
            abort(403, 'Sale is not accessible in your branch session.');
        }
    }
}