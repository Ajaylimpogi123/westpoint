<?php

namespace App\Services;

use App\Models\ProductQty;
use Illuminate\Database\Eloquent\Builder;

class InventoryStockService
{
    /**
     * Add stock to an existing batch when lot, expiry, and shelf match; otherwise create a new batch.
     */
    public static function addStock(
        int $productId,
        int $branchId,
        int $quantityInPieces,
        ?string $lotNumber = null,
        ?string $expiry = null,
        ?string $shelfNumber = null,
    ): ProductQty {
        $lotNumber = self::normalizeOptionalString($lotNumber);
        $shelfNumber = self::normalizeOptionalString($shelfNumber);
        $expiry = ($expiry === null || $expiry === '') ? null : $expiry;

        $existingBatch = self::findMatchingBatch(
            $productId,
            $branchId,
            $lotNumber,
            $expiry,
            $shelfNumber,
        );

        if ($existingBatch) {
            $existingBatch->increment('quantity', $quantityInPieces);
            self::afterStockAdded($existingBatch->fresh());

            return $existingBatch->fresh();
        }

        $batch = ProductQty::create([
            'product_id' => $productId,
            'quantity' => $quantityInPieces,
            'status' => 'Active',
            'lot_number' => $lotNumber,
            'expiry' => $expiry,
            'shelf_number' => $shelfNumber,
        ]);

        self::afterStockAdded($batch);

        return $batch;
    }

    public static function findMatchingBatch(
        int $productId,
        int $branchId,
        ?string $lotNumber,
        ?string $expiry,
        ?string $shelfNumber,
    ): ?ProductQty {
        return self::matchingBatchQuery($productId, $branchId, $lotNumber, $expiry, $shelfNumber)
            ->first();
    }

    private static function matchingBatchQuery(
        int $productId,
        int $branchId,
        ?string $lotNumber,
        ?string $expiry,
        ?string $shelfNumber,
    ): Builder {
        $query = ProductQty::query()
            ->where('product_id', $productId)
            ->where('status', '!=', 'Deleted')
            ->whereHas('product', fn (Builder $productQuery) => $productQuery->where('branch_id', $branchId));

        self::applyNullableStringMatch($query, 'lot_number', $lotNumber);
        self::applyNullableDateMatch($query, 'expiry', $expiry);
        self::applyNullableStringMatch($query, 'shelf_number', $shelfNumber);

        return $query;
    }

    private static function normalizeOptionalString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private static function applyNullableStringMatch(
        Builder $query,
        string $column,
        ?string $value,
    ): void {
        if ($value === null) {
            $query->where(function (Builder $innerQuery) use ($column) {
                $innerQuery->whereNull($column)->orWhere($column, '');
            });

            return;
        }

        $query->where($column, $value);
    }

    private static function applyNullableDateMatch(
        Builder $query,
        string $column,
        ?string $value,
    ): void {
        if ($value === null) {
            $query->whereNull($column);

            return;
        }

        $query->whereDate($column, $value);
    }
    /**
     * Normalize lot status after a quantity change.
     * Empty active lots become Inactive; restocked lots become Active again.
     */
    public static function afterBatchQuantityChange(ProductQty $batch): void
    {
        $batch->refresh();

        if ((int) $batch->quantity <= 0) {
            if ($batch->status === 'Active') {
                $batch->update(['status' => 'Inactive']);
            }

            return;
        }

        if ($batch->status !== 'Active' && $batch->status !== 'Deleted') {
            $batch->update(['status' => 'Active']);
        }
    }

    /**
     * Reactivate a lot when stock is added back to an existing or new batch.
     */
    public static function afterStockAdded(ProductQty $batch): void
    {
        $batch->refresh();

        if ((int) $batch->quantity > 0 && $batch->status !== 'Active' && $batch->status !== 'Deleted') {
            $batch->update(['status' => 'Active']);
        }
    }

    public static function totalAvailableStock(int $productId): int
    {
        return (int) ProductQty::query()
            ->where('product_id', $productId)
            ->available()
            ->sum('quantity');
    }
}
