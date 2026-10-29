<?php

namespace App\Http\Controllers;

use App\Exceptions\InsufficientStockException;
use App\Models\Branch;
use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\StockTransferLog;
use App\Services\InventoryMovementLogger;
use App\Services\InventoryStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StockTransferController extends Controller
{
    private const MAX_QUANTITY = InventoryStockService::MAX_TRANSACTION_QUANTITY;

    private const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

    // ──────────────────────────────────────────────────────
    // INDEX
    // ──────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $user = auth()->user();
        $canViewAll = $this->canViewAll();
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status');

        $relations = [
            'fromBranch',
            'toBranch',
            'requester',
            'approver',
            'items.product',
            'logs.performer',
        ];

        $transfers = StockTransfer::with($relations)
            ->when(! $canViewAll, fn ($query) => $query->where('requested_by', $user->id))
            ->when(in_array($status, self::STATUSES, true), fn ($query) => $query->where('status', $status))
            ->when($search !== '', fn ($query) => $this->applySearch($query, $search))
            ->orderByRaw("FIELD(status, 'pending', 'approved', 'rejected', 'cancelled')")
            ->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        // The Pending tab lists every pending request, not just the ones that
        // happen to fall on the current page of the paginated list.
        $pendingTransfers = $canViewAll
            ? StockTransfer::with($relations)
                ->where('status', 'pending')
                ->orderByRaw("FIELD(priority, 'urgent', 'normal', 'routine')")
                ->orderBy('created_at')
                ->get()
            : [];

        $branches = Branch::whereNull('deleted_at')
            ->orderBy('branch_name')
            ->get(['id', 'branch_name']);

        $sourceBranchId = $canViewAll
            ? ($this->sessionBranchId() ?? $branches->first()?->id)
            : $this->sessionBranchId();

        return Inertia::render('StockTransfer/Index', [
            'transfers' => $transfers,
            'pendingTransfers' => $pendingTransfers,
            'filters' => [
                'search' => $search,
                'status' => in_array($status, self::STATUSES, true) ? $status : 'all',
            ],
            'canViewAll' => $canViewAll,
            'canApprove' => $this->canApprove(),
            'canChooseSource' => $canViewAll,
            'currentUserId' => $user->id,
            'products' => $sourceBranchId ? $this->sourceProductsFor($sourceBranchId) : [],
            'branches' => $branches,
            'userBranch' => $sourceBranchId,
            'userBranchName' => $sourceBranchId
                ? $branches->firstWhere('id', $sourceBranchId)?->branch_name ?? ''
                : '',
        ]);
    }

    /**
     * Medicines with transferable lots in a source branch. Admins and
     * superadmins may load any branch; staff only their own.
     */
    public function sourceProducts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->whereNull('deleted_at')],
        ]);

        $branchId = (int) $validated['branch_id'];

        if (! $this->canViewAll() && $branchId !== $this->branchIdOrFail()) {
            abort(403, 'You can only transfer stock from your own branch.');
        }

        return response()->json(['products' => $this->sourceProductsFor($branchId)]);
    }

    // ──────────────────────────────────────────────────────
    // STORE
    // ──────────────────────────────────────────────────────

    public function store(Request $request): RedirectResponse
    {
        $canChooseSource = $this->canViewAll();
        $activeBranch = Rule::exists('branches', 'id')->whereNull('deleted_at');

        $validated = $request->validate([
            'from_branch_id' => $canChooseSource
                ? ['required', 'integer', $activeBranch]
                : ['nullable', 'integer'],
            'to_branch_id' => ['required', 'integer', $activeBranch],
            'priority' => 'required|in:normal,urgent,routine',
            'reason' => 'nullable|string|max:1000',
            'needed_by' => 'nullable|date|after:today',
            'transfer_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:tbl_products,id',
            'items.*.products_qty_id' => 'required|integer|exists:products_qty,id',
            'items.*.quantity_requested' => 'required|integer|min:1|max:'.self::MAX_QUANTITY,
        ]);

        // Staff always transfer out of their session branch; the payload can't
        // point at another branch's stock. Admins and superadmins choose.
        if ($canChooseSource) {
            $fromBranchId = (int) $validated['from_branch_id'];
        } else {
            $fromBranchId = $this->branchIdOrFail();

            if (! empty($validated['from_branch_id']) && (int) $validated['from_branch_id'] !== $fromBranchId) {
                throw ValidationException::withMessages([
                    'from_branch_id' => 'You can only transfer stock from your own branch.',
                ]);
            }
        }

        if ((int) $validated['to_branch_id'] === $fromBranchId) {
            throw ValidationException::withMessages([
                'to_branch_id' => 'A transfer must go to a different branch.',
            ]);
        }

        try {
            // Resolve every lot before writing anything, so an invalid line
            // fails validation rather than part-way through the transaction.
            $resolved = [];
            $requestedPerLot = [];

            foreach ($validated['items'] as $index => $item) {
                $line = $this->resolveTransferLine(
                    $fromBranchId,
                    (int) $item['product_id'],
                    (int) $item['products_qty_id'],
                    (int) $item['quantity_requested'],
                    $index,
                );

                // The same lot on two lines must fit in the lot as a whole,
                // not just line by line.
                $lotId = $line['lot']->id;
                $requestedPerLot[$lotId] = ($requestedPerLot[$lotId] ?? 0) + $line['quantity'];

                if ($requestedPerLot[$lotId] > (int) $line['lot']->quantity) {
                    throw new \RuntimeException(
                        "Lot {$line['lot']->lot_number}: {$requestedPerLot[$lotId]} pieces requested in total, "
                        ."but only {$line['lot']->quantity} are available."
                    );
                }

                $resolved[] = $line;
            }
        } catch (InsufficientStockException|\RuntimeException $exception) {
            return back()->withInput()->withErrors(['items' => $exception->getMessage()]);
        }

        DB::transaction(function () use ($validated, $fromBranchId, $resolved) {
            $transfer = StockTransfer::create([
                'transfer_no' => StockTransfer::generateTransferNo(),
                'from_branch_id' => $fromBranchId,
                'to_branch_id' => $validated['to_branch_id'],
                'requested_by' => auth()->id(),
                'status' => 'pending',
                'priority' => $validated['priority'],
                'reason' => $validated['reason'] ?? null,
                'needed_by' => $validated['needed_by'] ?? null,
                'transfer_date' => $validated['transfer_date'],
            ]);

            foreach ($resolved as $line) {
                StockTransferItem::create([
                    'stock_transfer_id' => $transfer->id,
                    'product_id' => $line['product']->id,
                    'products_qty_id' => $line['lot']->id,
                    // Lot number and expiry are copied from the batch rather
                    // than trusted from the request, so the recorded line
                    // always describes the batch it actually points at.
                    'lot_number' => $line['lot']->lot_number,
                    'expiry' => $line['lot']->expiry,
                    'quantity_requested' => $line['quantity'],
                ]);
            }

            StockTransferLog::create([
                'stock_transfer_id' => $transfer->id,
                'action' => 'created',
                'performed_by' => auth()->id(),
                'note' => 'Transfer request submitted.',
            ]);
        });

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer request submitted. Waiting for admin approval.');
    }

    // ──────────────────────────────────────────────────────
    // SHOW
    // ──────────────────────────────────────────────────────

    /**
     * There is no standalone detail page; details open in a modal on the
     * list. Old links land on the list filtered to this transfer.
     */
    public function show(StockTransfer $stockTransfer): RedirectResponse
    {
        $this->assertCanSee($stockTransfer);

        return redirect()->route('stock-transfers.index', ['search' => $stockTransfer->transfer_no]);
    }

    // ──────────────────────────────────────────────────────
    // APPROVE
    // ──────────────────────────────────────────────────────

    public function approve(Request $request, StockTransfer $stockTransfer): RedirectResponse
    {
        if (! $this->canApprove()) {
            abort(403);
        }

        $stockTransfer->load('items');

        $requestedById = $stockTransfer->items->keyBy('id');

        $request->validate([
            'approved_quantities' => 'nullable|array',
            // Approving more than was requested is not a partial approval, it
            // is an unaudited stock movement. The ceiling is per item, so it
            // has to be resolved per key rather than as a static max rule.
            'approved_quantities.*' => [
                'integer',
                'min:1',
                function (string $attribute, mixed $value, callable $fail) use ($requestedById) {
                    $itemId = (int) str_replace('approved_quantities.', '', $attribute);
                    $item = $requestedById->get($itemId);

                    if (! $item) {
                        $fail('That line is not part of this transfer.');

                        return;
                    }

                    if ((int) $value > (int) $item->quantity_requested) {
                        $fail("Lot {$item->lot_number}: cannot approve more than the {$item->quantity_requested} requested.");
                    }
                },
            ],
        ]);

        try {
            DB::transaction(function () use ($request, $stockTransfer) {
                // Lock and re-check, so two admins approving at once can't
                // move the same stock twice.
                $transfer = $this->lockPendingOrFail($stockTransfer);
                $transfer->load('items', 'fromBranch', 'toBranch');

                if ($request->filled('approved_quantities')) {
                    foreach ($transfer->items as $item) {
                        if (isset($request->approved_quantities[$item->id])) {
                            $item->update([
                                'quantity_approved' => $request->approved_quantities[$item->id],
                            ]);
                        }
                    }

                    $transfer->load('items');
                }

                $transfer->update([
                    'status' => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);

                StockTransferLog::create([
                    'stock_transfer_id' => $transfer->id,
                    'action' => 'approved',
                    'performed_by' => auth()->id(),
                    'note' => 'Transfer approved by admin.',
                ]);

                $this->moveStock($transfer);
            });
        } catch (InsufficientStockException|\RuntimeException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors([
                'status' => 'The transfer could not be approved. Please try again.',
            ]);
        }

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer approved and stock has been moved.');
    }

    // ──────────────────────────────────────────────────────
    // REJECT
    // ──────────────────────────────────────────────────────

    public function reject(Request $request, StockTransfer $stockTransfer): RedirectResponse
    {
        if (! $this->canApprove()) {
            abort(403);
        }

        $validated = $request->validate([
            'rejection_note' => 'required|string|max:500',
        ]);

        try {
            DB::transaction(function () use ($validated, $stockTransfer) {
                $transfer = $this->lockPendingOrFail($stockTransfer);

                $transfer->update([
                    'status' => 'rejected',
                    'rejection_note' => $validated['rejection_note'],
                ]);

                StockTransferLog::create([
                    'stock_transfer_id' => $transfer->id,
                    'action' => 'rejected',
                    'performed_by' => auth()->id(),
                    'note' => $validated['rejection_note'],
                ]);
            });
        } catch (\RuntimeException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors(['status' => 'The transfer could not be rejected. Please try again.']);
        }

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer request rejected.');
    }

    // ──────────────────────────────────────────────────────
    // CANCEL
    // ──────────────────────────────────────────────────────

    public function cancel(StockTransfer $stockTransfer): RedirectResponse
    {
        if ((int) $stockTransfer->requested_by !== (int) auth()->id()) {
            abort(403);
        }

        try {
            DB::transaction(function () use ($stockTransfer) {
                $transfer = $this->lockPendingOrFail($stockTransfer, 'Only pending transfers can be cancelled.');

                $transfer->update(['status' => 'cancelled']);

                StockTransferLog::create([
                    'stock_transfer_id' => $transfer->id,
                    'action' => 'cancelled',
                    'performed_by' => auth()->id(),
                    'note' => 'Cancelled by requester.',
                ]);
            });
        } catch (\RuntimeException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors(['status' => 'The transfer could not be cancelled. Please try again.']);
        }

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer request cancelled.');
    }

    // ──────────────────────────────────────────────────────
    // SLIP
    // ──────────────────────────────────────────────────────

    public function slip(StockTransfer $stockTransfer): Response
    {
        // Only approved transfers have a slip
        if (! $stockTransfer->isApproved()) {
            abort(403, 'Transfer slip is only available for approved transfers.');
        }

        $this->assertCanSee($stockTransfer);

        $stockTransfer->load([
            'fromBranch',
            'toBranch',
            'requester',
            'approver',
            'items.product',
        ]);

        return Inertia::render('StockTransfer/TransferSlip', [
            'transfer' => $stockTransfer,
        ]);
    }

    // ──────────────────────────────────────────────────────
    // PRIVATE
    // ──────────────────────────────────────────────────────

    private function roleId(): int
    {
        return (int) (session('role_id') ?? auth()->user()?->role_id);
    }

    /** Admins approve and reject; superadmins can see but not approve. */
    private function canApprove(): bool
    {
        return $this->roleId() === 2;
    }

    private function canViewAll(): bool
    {
        return in_array($this->roleId(), [2, 3], true);
    }

    private function assertCanSee(StockTransfer $stockTransfer): void
    {
        if (! $this->canViewAll() && (int) $stockTransfer->requested_by !== (int) auth()->id()) {
            abort(403);
        }
    }

    private function lockPendingOrFail(
        StockTransfer $stockTransfer,
        string $message = 'This transfer has already been actioned.',
    ): StockTransfer {
        $transfer = StockTransfer::query()->whereKey($stockTransfer->id)->lockForUpdate()->firstOrFail();

        if (! $transfer->isPending()) {
            throw new \RuntimeException($message);
        }

        return $transfer;
    }

    private function applySearch($query, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';

        $query->where(function ($inner) use ($like) {
            $inner->where('transfer_no', 'like', $like)
                ->orWhereHas('fromBranch', fn ($q) => $q->where('branch_name', 'like', $like))
                ->orWhereHas('toBranch', fn ($q) => $q->where('branch_name', 'like', $like))
                ->orWhereHas('requester', fn ($q) => $q->where('name', 'like', $like))
                ->orWhereHas('items', fn ($q) => $q->where('lot_number', 'like', $like)
                    ->orWhereHas('product', fn ($p) => $p->where('med_name', 'like', $like)
                        ->orWhere('brand_name', 'like', $like)));
        });
    }

    private function sourceProductsFor(int $branchId)
    {
        return MedicineProduct::with(['productsQty' => function ($q) {
            $q->dispensable()->orderBy('expiry', 'asc');
        }])
            ->forBranch($branchId)
            ->active()
            ->orderBy('med_name')
            ->get(['id', 'med_name', 'dose', 'form', 'brand_name', 'branch_id', 'pack_size']);
    }

    /**
     * Validate that a requested line refers to a lot the source branch owns.
     *
     * product_id and products_qty_id used to be validated independently, so a
     * lot of one product could be submitted under another product's identity.
     *
     * @return array{product: MedicineProduct, lot: ProductQty, quantity: int}
     */
    private function resolveTransferLine(
        int $fromBranchId,
        int $productId,
        int $lotId,
        int $quantity,
        int $index,
    ): array {
        $line = 'Line '.($index + 1);

        $product = MedicineProduct::query()
            ->active()
            ->forBranch($fromBranchId)
            ->find($productId);

        if (! $product) {
            throw new \RuntimeException("{$line}: that medicine is not stocked in the source branch.");
        }

        $lot = ProductQty::query()
            ->whereKey($lotId)
            ->where('product_id', $product->id)
            ->first();

        if (! $lot || $lot->isDeleted()) {
            throw new \RuntimeException("{$line}: that lot does not belong to {$product->med_name}.");
        }

        if ($lot->isExpired()) {
            throw new \RuntimeException(
                "{$line}: lot {$lot->lot_number} expired on {$lot->expiry->format('d M Y')} and cannot be transferred."
            );
        }

        if ((int) $lot->quantity < $quantity) {
            throw InsufficientStockException::forLot($lot->lot_number, (int) $lot->quantity, $quantity);
        }

        return ['product' => $product, 'lot' => $lot, 'quantity' => $quantity];
    }

    /**
     * Move approved quantities from the source lots into the destination branch.
     *
     * The sufficiency check lives here, against the same locked rows the
     * deduction writes. It used to run in a separate unlocked loop in
     * approve(), leaving a window in which a concurrent sale could empty the
     * lot between the check and the decrement.
     */
    private function moveStock(StockTransfer $stockTransfer): void
    {
        foreach ($stockTransfer->items as $item) {
            $qtyToMove = (int) $item->effective_qty;

            if ($qtyToMove < 1) {
                continue;
            }

            $sourceProduct = MedicineProduct::findOrFail($item->product_id);

            $this->assertLotStillTransferable($item, $sourceProduct);

            // Locks, re-checks sufficiency, decrements, and normalizes status.
            InventoryStockService::deductFromBatch(
                batchId: (int) $item->products_qty_id,
                quantityInPieces: $qtyToMove,
                medicineName: $sourceProduct->med_name,
            );

            $destProduct = $this->resolveDestinationProduct($sourceProduct, (int) $stockTransfer->to_branch_id);

            // Reuse the shared merge rule (lot + expiry + shelf) instead of the
            // bespoke lot-number-only match this method used to carry. Matching
            // on lot number alone let incoming stock inherit the destination
            // row's expiry date, silently relabelling the batch.
            InventoryStockService::addStock(
                productId: $destProduct->id,
                branchId: (int) $stockTransfer->to_branch_id,
                quantityInPieces: $qtyToMove,
                lotNumber: $item->lot_number,
                expiry: $item->expiry?->format('Y-m-d'),
                shelfNumber: null,
            );

            $this->logTransferMovement($stockTransfer, $item, $sourceProduct, $destProduct, $qtyToMove);
        }

        StockTransferLog::create([
            'stock_transfer_id' => $stockTransfer->id,
            'action' => 'stock_moved',
            'performed_by' => auth()->id(),
            'note' => 'Stock quantities updated automatically upon approval.',
        ]);
    }

    /**
     * A request can sit pending for days. deductFromBatch() checks quantity
     * but not expiry, so a lot that expired (or was deleted) in the meantime
     * would otherwise be shipped to the other branch.
     */
    private function assertLotStillTransferable(StockTransferItem $item, MedicineProduct $sourceProduct): void
    {
        $lot = ProductQty::query()->whereKey($item->products_qty_id)->lockForUpdate()->first();

        if (! $lot || $lot->isDeleted() || (int) $lot->product_id !== (int) $sourceProduct->id) {
            throw new \RuntimeException(
                "Lot {$item->lot_number} of {$sourceProduct->med_name} is no longer available. Reject this request and ask for a new one."
            );
        }

        if ($lot->isExpired()) {
            throw new \RuntimeException(
                "Lot {$lot->lot_number} of {$sourceProduct->med_name} expired on {$lot->expiry->format('d M Y')} "
                .'and cannot be transferred. Reject this request and ask for another lot.'
            );
        }
    }

    /**
     * Find the destination branch's copy of this medicine, creating it only
     * when the pack size matches.
     *
     * A pack_size mismatch means "1 box" denotes different amounts either side
     * of the transfer, so the transfer is refused rather than silently
     * changing what the stock represents.
     */
    private function resolveDestinationProduct(MedicineProduct $sourceProduct, int $toBranchId): MedicineProduct
    {
        $identity = [
            'branch_id' => $toBranchId,
            'med_name' => $sourceProduct->med_name,
            'dose' => $sourceProduct->dose,
            'form' => $sourceProduct->form,
            'brand_name' => $sourceProduct->brand_name,
        ];

        // Match case/whitespace-insensitively so a branch's "amoxicillin " still
        // receives stock into its existing "Amoxicillin" instead of a new copy.
        $destProduct = MedicineProduct::query()
            ->forBranch($toBranchId)
            ->sameIdentity(
                $sourceProduct->med_name,
                $sourceProduct->dose,
                $sourceProduct->form,
                $sourceProduct->brand_name,
            )
            ->orderBy('id')
            ->first();

        if ($destProduct) {
            if ((int) $destProduct->pack_size !== (int) $sourceProduct->pack_size) {
                throw new \RuntimeException(
                    "{$sourceProduct->med_name} has a pack size of {$sourceProduct->pack_size} in the source branch "
                    ."but {$destProduct->pack_size} in the destination. Reconcile the pack sizes before transferring."
                );
            }

            return $destProduct;
        }

        return MedicineProduct::create($identity + [
            'pack_size' => $sourceProduct->pack_size,
            'retail_price' => $sourceProduct->retail_price,
            'wholesale_price' => $sourceProduct->wholesale_price,
            'vat_status' => $sourceProduct->vat_status ?? 'Non-VAT',
            'stock_threshold' => $sourceProduct->stock_threshold,
            'is_generic' => $sourceProduct->is_generic,
            'status' => 'Active',
        ]);
    }

    /**
     * Transfers previously wrote only to the transfer-specific log, so the
     * inventory movement ledger — the thing an auditor reconciles against —
     * silently omitted all inter-branch movement.
     */
    private function logTransferMovement(
        StockTransfer $stockTransfer,
        StockTransferItem $item,
        MedicineProduct $sourceProduct,
        MedicineProduct $destProduct,
        int $qtyToMove,
    ): void {
        $reference = "Transfer {$stockTransfer->transfer_no}";

        InventoryMovementLogger::log(
            branchId: (int) $stockTransfer->from_branch_id,
            movementType: InventoryMovementLog::TYPE_TRANSFER_OUT,
            referenceLabel: $reference,
            referenceId: $stockTransfer->id,
            pdId: $sourceProduct->id,
            medicineName: $sourceProduct->med_name,
            lotNumber: $item->lot_number,
            quantity: -$qtyToMove,
            remarks: "Transferred to {$stockTransfer->toBranch?->branch_name}.",
        );

        InventoryMovementLogger::log(
            branchId: (int) $stockTransfer->to_branch_id,
            movementType: InventoryMovementLog::TYPE_TRANSFER_IN,
            referenceLabel: $reference,
            referenceId: $stockTransfer->id,
            pdId: $destProduct->id,
            medicineName: $destProduct->med_name,
            lotNumber: $item->lot_number,
            quantity: $qtyToMove,
            remarks: "Received from {$stockTransfer->fromBranch?->branch_name}.",
        );
    }

    private function sessionBranchId(): ?int
    {
        $branchId = session('branch_id') ?? auth()->user()?->branch_id;

        return $branchId ? (int) $branchId : null;
    }

    private function branchIdOrFail(): int
    {
        $branchId = $this->sessionBranchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }
}
