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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StockTransferController extends Controller
{
    private const MAX_QUANTITY = InventoryStockService::MAX_TRANSACTION_QUANTITY;

    // ──────────────────────────────────────────────────────
    // INDEX
    // ──────────────────────────────────────────────────────

    public function index(): Response
    {
        $user    = auth()->user();
        $isAdmin = $user->role_id === 2;

        $query = StockTransfer::with([
            'fromBranch',
            'toBranch',
            'requester',
            'approver',
            'items.product',
            'logs.performer',
        ]);

        if ($isAdmin) {
            $transfers = $query
                ->orderByRaw("FIELD(status, 'pending', 'approved', 'rejected', 'cancelled')")
                ->orderBy('created_at', 'desc')
                ->paginate(15)
                ->withQueryString();
        } else {
            $transfers = $query
                ->where('requested_by', $user->id)
                ->orderBy('created_at', 'desc')
                ->paginate(15)
                ->withQueryString();
        }

        $products = [];
        $branches = [];

        if (! $isAdmin) {
            $products = MedicineProduct::with(['productsQty' => function ($q) {
                    $q->dispensable()->orderBy('expiry', 'asc');
                }])
                ->where('branch_id', $user->branch_id)
                ->where('status', 'Active')
                ->get(['id', 'med_name', 'dose', 'form', 'brand_name', 'branch_id', 'pack_size']);

            $branches = Branch::whereNull('deleted_at')
                ->where('id', '!=', $user->branch_id)
                ->get(['id', 'branch_name']);
        }

        return Inertia::render('StockTransfer/Index', [
            'transfers'      => $transfers,
            'isAdmin'        => $isAdmin,
            'products'       => $products,
            'branches'       => $branches,
            'userBranch'     => $user->branch_id,
            'userBranchName' => optional($user->branch)->branch_name ?? '',
        ]);
    }

    // ──────────────────────────────────────────────────────
    // STORE
    // ──────────────────────────────────────────────────────

    public function store(Request $request): RedirectResponse
    {
        // The source branch comes from the session, never the payload. It used
        // to be accepted from the request with no ownership check, so a
        // crafted from_branch_id could drain another branch's stock.
        $fromBranchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'to_branch_id'               => ['required', 'exists:branches,id', Rule::notIn([$fromBranchId])],
            'priority'                   => 'required|in:normal,urgent,routine',
            'reason'                     => 'nullable|string|max:1000',
            'needed_by'                  => 'nullable|date|after:today',
            'transfer_date'              => 'required|date',
            'items'                      => 'required|array|min:1',
            'items.*.product_id'         => 'required|integer|exists:tbl_products,id',
            'items.*.products_qty_id'    => 'required|integer|exists:products_qty,id',
            'items.*.quantity_requested' => 'required|integer|min:1|max:' . self::MAX_QUANTITY,
        ], [
            'to_branch_id.not_in' => 'A transfer must go to a different branch.',
        ]);

        try {
            // Resolve every lot before writing anything, so an invalid line
            // fails validation rather than part-way through the transaction.
            $resolved = [];

            foreach ($validated['items'] as $index => $item) {
                $resolved[] = $this->resolveTransferLine(
                    $fromBranchId,
                    (int) $item['product_id'],
                    (int) $item['products_qty_id'],
                    (int) $item['quantity_requested'],
                    $index,
                );
            }
        } catch (InsufficientStockException | \RuntimeException $exception) {
            return back()->withInput()->withErrors(['items' => $exception->getMessage()]);
        }

        DB::transaction(function () use ($validated, $fromBranchId, $resolved) {
            $transfer = StockTransfer::create([
                'transfer_no'    => StockTransfer::generateTransferNo(),
                'from_branch_id' => $fromBranchId,
                'to_branch_id'   => $validated['to_branch_id'],
                'requested_by'   => auth()->id(),
                'status'         => 'pending',
                'priority'       => $validated['priority'],
                'reason'         => $validated['reason'] ?? null,
                'needed_by'      => $validated['needed_by'] ?? null,
                'transfer_date'  => $validated['transfer_date'],
            ]);

            foreach ($resolved as $line) {
                StockTransferItem::create([
                    'stock_transfer_id'  => $transfer->id,
                    'product_id'         => $line['product']->id,
                    'products_qty_id'    => $line['lot']->id,
                    // Lot number and expiry are copied from the batch rather
                    // than trusted from the request, so the recorded line
                    // always describes the batch it actually points at.
                    'lot_number'         => $line['lot']->lot_number,
                    'expiry'             => $line['lot']->expiry,
                    'quantity_requested' => $line['quantity'],
                ]);
            }

            StockTransferLog::create([
                'stock_transfer_id' => $transfer->id,
                'action'            => 'created',
                'performed_by'      => auth()->id(),
                'note'              => 'Transfer request submitted.',
            ]);
        });

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer request submitted. Waiting for admin approval.');
    }

    // ──────────────────────────────────────────────────────
    // SHOW
    // ──────────────────────────────────────────────────────

    public function show(StockTransfer $stockTransfer): Response
    {
        $user    = auth()->user();
        $isAdmin = $user->role_id === 2;

        if (! $isAdmin && $stockTransfer->requested_by !== $user->id) {
            abort(403);
        }

        $stockTransfer->load([
            'fromBranch',
            'toBranch',
            'requester',
            'approver',
            'items.product',
            'items.productsQty',
            'logs.performer',
        ]);

        return Inertia::render('StockTransfer/Show', [
            'transfer' => $stockTransfer,
            'isAdmin'  => $isAdmin,
        ]);
    }

    // ──────────────────────────────────────────────────────
    // APPROVE
    // ──────────────────────────────────────────────────────

    public function approve(Request $request, StockTransfer $stockTransfer): RedirectResponse
    {
        if (auth()->user()->role_id !== 2) {
            abort(403);
        }

        if (! $stockTransfer->isPending()) {
            return back()->withErrors(['status' => 'This transfer has already been actioned.']);
        }

        $stockTransfer->load('items');

        $requestedById = $stockTransfer->items->keyBy('id');

        $request->validate([
            'approved_quantities'   => 'nullable|array',
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
                if ($request->filled('approved_quantities')) {
                    foreach ($stockTransfer->items as $item) {
                        if (isset($request->approved_quantities[$item->id])) {
                            $item->update([
                                'quantity_approved' => $request->approved_quantities[$item->id],
                            ]);
                        }
                    }
                }

                $stockTransfer->load('items');

                $stockTransfer->update([
                    'status'      => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]);

                StockTransferLog::create([
                    'stock_transfer_id' => $stockTransfer->id,
                    'action'            => 'approved',
                    'performed_by'      => auth()->id(),
                    'note'              => 'Transfer approved by admin.',
                ]);

                $this->moveStock($stockTransfer);
            });
        } catch (InsufficientStockException | \RuntimeException $exception) {
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
        if (auth()->user()->role_id !== 2) {
            abort(403);
        }

        if (! $stockTransfer->isPending()) {
            return back()->withErrors(['status' => 'This transfer has already been actioned.']);
        }

        $validated = $request->validate([
            'rejection_note' => 'required|string|max:500',
        ]);

        try {
            DB::transaction(function () use ($validated, $stockTransfer) {
                $stockTransfer->update([
                    'status'         => 'rejected',
                    'rejection_note' => $validated['rejection_note'],
                ]);

                StockTransferLog::create([
                    'stock_transfer_id' => $stockTransfer->id,
                    'action'            => 'rejected',
                    'performed_by'      => auth()->id(),
                    'note'              => $validated['rejection_note'],
                ]);
            });
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
        $user = auth()->user();

        if ($stockTransfer->requested_by !== $user->id) {
            abort(403);
        }

        if (! $stockTransfer->isPending()) {
            return back()->withErrors(['status' => 'Only pending transfers can be cancelled.']);
        }

        try {
            DB::transaction(function () use ($stockTransfer) {
                $stockTransfer->update(['status' => 'cancelled']);

                StockTransferLog::create([
                    'stock_transfer_id' => $stockTransfer->id,
                    'action'            => 'cancelled',
                    'performed_by'      => auth()->id(),
                    'note'              => 'Cancelled by requester.',
                ]);
            });
        } catch (Throwable $exception) {
            report($exception);

            return back()->withErrors(['status' => 'The transfer could not be cancelled. Please try again.']);
        }

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer request cancelled.');
    }

    // ──────────────────────────────────────────────────────
    // PRIVATE
    // ──────────────────────────────────────────────────────

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
        $line = 'Line ' . ($index + 1);

        $product = MedicineProduct::query()
            ->active()
            ->forBranch($fromBranchId)
            ->find($productId);

        if (! $product) {
            throw new \RuntimeException("{$line}: that medicine is not stocked in your branch.");
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
            'action'            => 'stock_moved',
            'performed_by'      => auth()->id(),
            'note'              => 'Stock quantities updated automatically upon approval.',
        ]);
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
            'branch_id'  => $toBranchId,
            'med_name'   => $sourceProduct->med_name,
            'dose'       => $sourceProduct->dose,
            'form'       => $sourceProduct->form,
            'brand_name' => $sourceProduct->brand_name,
        ];

        $destProduct = MedicineProduct::where($identity)->first();

        if ($destProduct) {
            if ((int) $destProduct->pack_size !== (int) $sourceProduct->pack_size) {
                throw new \RuntimeException(
                    "{$sourceProduct->med_name} has a pack size of {$sourceProduct->pack_size} in the source branch "
                    . "but {$destProduct->pack_size} in the destination. Reconcile the pack sizes before transferring."
                );
            }

            return $destProduct;
        }

        return MedicineProduct::create($identity + [
            'pack_size'       => $sourceProduct->pack_size,
            'retail_price'    => $sourceProduct->retail_price,
            'wholesale_price' => $sourceProduct->wholesale_price,
            'stock_threshold' => $sourceProduct->stock_threshold,
            'is_generic'      => $sourceProduct->is_generic,
            'status'          => 'Active',
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

    private function branchIdOrFail(): int
    {
        $branchId = session('branch_id') ?? auth()->user()?->branch_id;

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return (int) $branchId;
    }

    public function slip(StockTransfer $stockTransfer): Response
    {
        // Only approved transfers have a slip
        if (! $stockTransfer->isApproved()) {
            abort(403, 'Transfer slip is only available for approved transfers.');
        }

        // Staff can only view their own slip
        $user    = auth()->user();
        $isAdmin = $user->role_id === 2;

        if (! $isAdmin && $stockTransfer->requested_by !== $user->id) {
            abort(403);
        }

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
}
