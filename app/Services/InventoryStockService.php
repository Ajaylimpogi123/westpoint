<?php

namespace App\Services;

use App\Models\ProductQty;

class InventoryStockService
{
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
