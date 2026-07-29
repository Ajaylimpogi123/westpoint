<?php

namespace App\Console\Commands;

use App\Models\InventoryMovementLog;
use App\Models\ProductQty;
use App\Services\InventoryMovementLogger;
use Illuminate\Console\Command;

/**
 * Moves lapsed batches out of the dispensable pool.
 *
 * The query-level guard in ProductQty::scopeDispensable() already prevents
 * expired stock from being sold, but a batch left sitting in Active status
 * still shows as sellable on stock reports and gives no signal that physical
 * stock needs pulling from the shelf. This marks it Expired so it surfaces on
 * a disposal worklist.
 *
 * Expired is deliberately a distinct status rather than a reuse of Inactive:
 * Inactive means "empty", and InventoryStockService flips it back to Active
 * the moment quantity goes above zero.
 */
class ExpireLapsedBatches extends Command
{
    protected $signature = 'inventory:expire-batches
                            {--dry-run : List the batches that would be expired without changing them}';

    protected $description = 'Mark batches whose expiry date has passed as Expired';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $batches = ProductQty::query()
            ->with('product:id,branch_id,med_name')
            ->expired()
            ->whereIn('status', [ProductQty::STATUS_ACTIVE, ProductQty::STATUS_INACTIVE])
            ->get();

        if ($batches->isEmpty()) {
            $this->info('No lapsed batches found.');

            return self::SUCCESS;
        }

        foreach ($batches as $batch) {
            $product = $batch->product;
            $lot = $batch->lot_number ?? '(no lot)';
            $name = $product?->med_name ?? "Product #{$batch->product_id}";
            $expiry = $batch->expiry?->format('Y-m-d');

            if ($dryRun) {
                $this->line("Would expire: {$name} · lot {$lot} · exp {$expiry} · {$batch->quantity} pcs");

                continue;
            }

            $batch->update(['status' => ProductQty::STATUS_EXPIRED]);

            // Only log a movement when stock is actually stranded; expiring an
            // empty batch is bookkeeping, not a stock event.
            if ((int) $batch->quantity > 0 && $product?->branch_id) {
                InventoryMovementLogger::log(
                    branchId: (int) $product->branch_id,
                    movementType: InventoryMovementLog::TYPE_BATCH_EXPIRED,
                    referenceLabel: "Batch #{$batch->id}",
                    referenceId: $batch->id,
                    pdId: $batch->product_id,
                    medicineName: $name,
                    lotNumber: $batch->lot_number,
                    quantity: 0,
                    remarks: "Lot expired on {$expiry}; {$batch->quantity} piece(s) withdrawn from sale.",
                    performedBy: null,
                );
            }
        }

        $this->info(
            $dryRun
                ? "{$batches->count()} batch(es) would be expired."
                : "{$batches->count()} batch(es) marked as Expired."
        );

        return self::SUCCESS;
    }
}
