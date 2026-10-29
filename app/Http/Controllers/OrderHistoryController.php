<?php

namespace App\Http\Controllers;

use App\Models\InventoryMovementLog;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleReturn;
use App\Models\SaleReturnItem;
use App\Services\IdempotencyGuard;
use App\Services\InventoryMovementLogger;
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
                'sales_remarks',
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
                'sales_remarks' => $sale->sales_remarks,
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
                    'discount_amount',
                    'vat_exempt',
                ]);
            },
            'items.product:id,med_name,dose,form,brand_name,vat_status',
            'user:id,name',
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

        // D1: a double-click or network retry of the same void must not
        // restock and refund twice. Recognised before validation, because the
        // first request already consumed the quantities being re-validated.
        $idempotencyKey = $request->input('idempotency_key');
        $idempotencyKey = is_string($idempotencyKey) ? $idempotencyKey : null;

        if (IdempotencyGuard::isClaimed(IdempotencyGuard::SCOPE_SALE_VOID, $idempotencyKey)) {
            return $this->alreadyProcessedResponse($sale);
        }

        $validated = $request->validate([
            'idempotency_key' => ['nullable', 'string', 'max:255'],
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

        if (! IdempotencyGuard::claim(IdempotencyGuard::SCOPE_SALE_VOID, $idempotencyKey)) {
            return $this->alreadyProcessedResponse($sale);
        }

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

                // Pieces come from what the line actually deducted at
                // checkout (pieces_sold), not from today's pack_size.
                $alreadyReturned = (int) $saleItem->returned_quantity;
                $piecesBefore = intdiv(
                    $saleItem->piecesSold() * $alreadyReturned,
                    max((int) $saleItem->quantity_sold, 1)
                );
                $piecesToRestock = $saleItem->piecesForReturn($quantityReturned, $alreadyReturned);

                $restockedBatches = $this->restockPieces(
                    $sale,
                    $saleItem,
                    $piecesBefore,
                    $piecesToRestock,
                    $branchId
                );

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
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_SALE_VOID, $idempotencyKey);

            return response()->json(['message' => $this->userMessage($e, 'Failed to process the void/return. Please try again.')], 422);
        } catch (\Throwable $e) {
            DB::rollBack();
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_SALE_VOID, $idempotencyKey);
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
     * Restock a return of $piecesToRestock pieces, the line having already
     * had $piecesBefore pieces restocked by earlier returns.
     *
     * Single-batch lines go back to their batch. Split-batch lines are
     * filled back lot by lot in the order they were deducted (earliest
     * expiry first), cumulatively, so returning a line in several parts puts
     * every lot back to exactly what it gave. Where the pieces land when a
     * lot is Expired/Deleted is decided by InventoryStockService::restockReturn().
     *
     * @return array<int, array{products_qty_id: int, pieces: int, rule: string}>
     */
    private function restockPieces(
        Sale $sale,
        SaleItem $saleItem,
        int $piecesBefore,
        int $piecesToRestock,
        int $branchId
    ): array {
        if ($piecesToRestock < 1) {
            return [];
        }

        $allocations = $saleItem->allocations()->orderBy('id')->get();

        if ($allocations->isEmpty()) {
            return [$this->restockIntoBatch($sale, $saleItem, $saleItem->products_qty_id, $piecesToRestock, $branchId)];
        }

        $piecesAfter = $piecesBefore + $piecesToRestock;
        $restocked = [];
        $filledBefore = 0;

        foreach ($allocations as $allocation) {
            $capacity = (int) $allocation->pieces;
            $beforeHere = min(max($piecesBefore - $filledBefore, 0), $capacity);
            $afterHere = min(max($piecesAfter - $filledBefore, 0), $capacity);
            $filledBefore += $capacity;

            $share = $afterHere - $beforeHere;

            if ($share > 0) {
                $restocked[] = $this->restockIntoBatch($sale, $saleItem, $allocation->products_qty_id, $share, $branchId);
            }
        }

        // Legacy split lines whose allocations sum to less than pieces_sold:
        // never lose returned pieces, put the overflow back on the last lot.
        $overflow = $piecesToRestock - array_sum(array_column($restocked, 'pieces'));

        if ($overflow > 0) {
            $restocked[] = $this->restockIntoBatch(
                $sale,
                $saleItem,
                $allocations->last()->products_qty_id,
                $overflow,
                $branchId
            );
        }

        return $restocked;
    }

    /**
     * @return array{products_qty_id: int, pieces: int, rule: string}
     */
    private function restockIntoBatch(
        Sale $sale,
        SaleItem $saleItem,
        ?int $originalBatchId,
        int $pieces,
        int $branchId
    ): array {
        $result = InventoryStockService::restockReturn(
            productId: (int) $saleItem->product_id,
            branchId: $branchId,
            originalBatchId: $originalBatchId,
            quantityInPieces: $pieces,
        );

        /** @var ProductQty $batch */
        $batch = $result['batch'];

        $remarks = match ($result['rule']) {
            InventoryStockService::RESTOCK_RULE_EXPIRED => 'Sale void/return: restocked into its expired lot (stays Expired, not sellable).',
            InventoryStockService::RESTOCK_RULE_REPLACEMENT => 'Sale void/return: original lot was removed, restocked into a lot with the same lot number and expiry.',
            InventoryStockService::RESTOCK_RULE_NEW_RETURN_LOT => 'Sale void/return: original lot not found, restocked into a new return lot.',
            default => 'Sale void/return: restocked into the original lot.',
        };

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_SALE_VOID,
            referenceLabel: "Sale {$sale->invoice_number}",
            referenceId: $sale->id,
            pdId: (int) $saleItem->product_id,
            medicineName: $saleItem->product?->med_name ?? 'Returned item',
            lotNumber: $batch->lot_number,
            quantity: $pieces,
            remarks: $remarks,
            metadata: [
                'sale_item_id' => $saleItem->id,
                'original_batch_id' => $originalBatchId,
                'restocked_batch_id' => $batch->id,
                'rule' => $result['rule'],
            ],
        );

        return ['products_qty_id' => (int) $batch->id, 'pieces' => $pieces, 'rule' => $result['rule']];
    }

    private function alreadyProcessedResponse(Sale $sale): JsonResponse
    {
        $sale->refresh();

        return response()->json([
            'message' => 'This void/return was already processed.',
            'already_processed' => true,
            'sale' => [
                'id' => $sale->id,
                'status' => $sale->status,
                'refunded_amount' => $sale->refunded_amount,
            ],
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
