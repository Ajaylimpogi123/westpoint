<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Branch;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Branch rules shared by Stock In, Stock Out and Customer Return.
 *
 * Admins and superadmins may record a transaction for any branch, whatever
 * their session branch is (or even without one). Staff are pinned to their
 * session branch. Products, lots and customers are always resolved against
 * the transaction's branch, never the session's.
 */
trait ResolvesTransactionBranch
{
    protected function canAssignBranch(): bool
    {
        return in_array((int) session('role_id'), [2, 3], true);
    }

    protected function sessionBranchId(): ?int
    {
        $branchId = session('branch_id');

        return $branchId ? (int) $branchId : null;
    }

    protected function branchIdOrFail(): int
    {
        $branchId = $this->sessionBranchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }

    /**
     * Staff need a session branch before they may submit anything. Admins
     * and superadmins do not.
     */
    protected function assertCanSubmitForAnyBranch(): void
    {
        if (! $this->canAssignBranch()) {
            $this->branchIdOrFail();
        }
    }

    /**
     * @return array<int, mixed>
     */
    protected function branchIdRules(): array
    {
        return [
            'required',
            'integer',
            Rule::exists('branches', 'id')->whereNull('deleted_at'),
        ];
    }

    /**
     * The branch a new transaction is recorded against.
     */
    protected function resolveTransactionBranchId(int $requestedBranchId): int
    {
        if ($this->canAssignBranch()) {
            return $requestedBranchId;
        }

        $sessionBranchId = $this->branchIdOrFail();

        if ($requestedBranchId !== $sessionBranchId) {
            throw ValidationException::withMessages([
                'branch_id' => 'You can only record transactions for your assigned branch.',
            ]);
        }

        return $sessionBranchId;
    }

    protected function assertCanAccessBranchTransaction(int $transactionBranchId, string $message): void
    {
        if ($this->canAssignBranch()) {
            return;
        }

        if ($transactionBranchId !== $this->branchIdOrFail()) {
            abort(403, $message);
        }
    }

    /**
     * Reject any basket line whose medicine (and, for stock-out, lot) is not
     * from the transaction's branch. Runs before the idempotency key is
     * claimed, so a rejected basket can be fixed and resent with the same key.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    protected function assertItemsBelongToBranch(array $items, int $branchId, bool $checkBatches = false): void
    {
        $branchName = Branch::withTrashed()->whereKey($branchId)->value('branch_name') ?? "branch #{$branchId}";

        $productIds = collect($items)->pluck('pd_id')->map(fn ($id) => (int) $id)->unique()->all();

        $products = MedicineProduct::query()
            ->whereKey($productIds)
            ->get(['id', 'branch_id', 'med_name', 'status'])
            ->keyBy('id');

        $batches = $checkBatches
            ? ProductQty::query()
                ->whereKey(collect($items)->pluck('products_qty_id')->map(fn ($id) => (int) $id)->unique()->all())
                ->get(['id', 'product_id', 'lot_number', 'expiry', 'status'])
                ->keyBy('id')
            : collect();

        $errors = [];

        foreach ($items as $index => $item) {
            $product = $products->get((int) $item['pd_id']);
            $name = $product?->med_name ?? 'This medicine';

            if (! $product || (int) $product->branch_id !== $branchId || $product->status !== 'Active') {
                $errors["items.{$index}.pd_id"] = "{$name} is not available in {$branchName}. Remove it from the list.";

                continue;
            }

            if (! $checkBatches) {
                continue;
            }

            $batch = $batches->get((int) ($item['products_qty_id'] ?? 0));

            if (! $batch || (int) $batch->product_id !== (int) $product->id || $batch->isDeleted()) {
                $errors["items.{$index}.products_qty_id"] = "The selected lot is not available for {$name} in {$branchName}.";

                continue;
            }

            if ($batch->status === ProductQty::STATUS_EXPIRED || $batch->isExpired()) {
                $expiry = $batch->expiry?->format('d M Y') ?? 'an earlier date';
                $errors["items.{$index}.products_qty_id"] = "Lot {$batch->lot_number} of {$name} expired on {$expiry} and cannot be dispensed.";
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Eager-load constraint giving `branch: {id, branch_name}`, keeping the
     * name of a branch that was later soft-deleted.
     */
    protected static function branchSummaryRelation(): array
    {
        return ['branch' => fn ($query) => $query->withTrashed()->select(['id', 'branch_name'])];
    }

    protected static function branchSummary($branch): ?array
    {
        return $branch ? ['id' => (int) $branch->id, 'branch_name' => $branch->branch_name] : null;
    }
}
