<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MedicineProduct;   // ← correct model name
use App\Models\ProductQty;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\StockTransferLog;
use App\Services\InventoryStockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class StockTransferController extends Controller
{
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
                    $q->available()
                      ->where('expiry', '>', now())
                      ->orderBy('expiry', 'asc');
                }])
                ->where('branch_id', $user->branch_id)
                ->where('status', 'Active')
                ->get(['id', 'med_name', 'dose', 'form', 'brand_name', 'branch_id']);

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
        $validated = $request->validate([
            'to_branch_id'               => 'required|exists:branches,id|different:from_branch_id',
            'from_branch_id'             => 'required|exists:branches,id',
            'priority'                   => 'required|in:normal,urgent,routine',
            'reason'                     => 'nullable|string|max:1000',
            'needed_by'                  => 'nullable|date|after:today',
            'transfer_date'              => 'required|date',
            'items'                      => 'required|array|min:1',
            'items.*.product_id'         => 'required|exists:tbl_products,id',
            'items.*.products_qty_id'    => 'required|exists:products_qty,id',
            'items.*.lot_number'         => 'required|string|max:50',
            'items.*.expiry'             => 'nullable|date',
            'items.*.quantity_requested' => 'required|integer|min:1',
        ]);

        foreach ($validated['items'] as $item) {
            $lot = ProductQty::find($item['products_qty_id']);
            if (! $lot || $lot->quantity < $item['quantity_requested']) {
                return back()->withErrors([
                    'items' => "Lot {$item['lot_number']} does not have enough stock.",
                ]);
            }
        }

        DB::transaction(function () use ($validated) {
            $transfer = StockTransfer::create([
                'transfer_no'    => StockTransfer::generateTransferNo(),
                'from_branch_id' => $validated['from_branch_id'],
                'to_branch_id'   => $validated['to_branch_id'],
                'requested_by'   => auth()->id(),
                'status'         => 'pending',
                'priority'       => $validated['priority'],
                'reason'         => $validated['reason'] ?? null,
                'needed_by'      => $validated['needed_by'] ?? null,
                'transfer_date'  => $validated['transfer_date'],
            ]);

            foreach ($validated['items'] as $item) {
                StockTransferItem::create([
                    'stock_transfer_id'  => $transfer->id,
                    'product_id'         => $item['product_id'],
                    'products_qty_id'    => $item['products_qty_id'],
                    'lot_number'         => $item['lot_number'],
                    'expiry'             => $item['expiry'] ?? null,
                    'quantity_requested' => $item['quantity_requested'],
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

        $request->validate([
            'approved_quantities'   => 'nullable|array',
            'approved_quantities.*' => 'integer|min:1',
        ]);

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

            foreach ($stockTransfer->items as $item) {
                $lot = ProductQty::find($item->products_qty_id);
                if (! $lot || $lot->quantity < $item->effective_qty) {
                    throw new \Exception("Insufficient stock for lot {$item->lot_number}.");
                }
            }

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

        DB::transaction(function () use ($stockTransfer) {
            $stockTransfer->update(['status' => 'cancelled']);

            StockTransferLog::create([
                'stock_transfer_id' => $stockTransfer->id,
                'action'            => 'cancelled',
                'performed_by'      => auth()->id(),
                'note'              => 'Cancelled by requester.',
            ]);
        });

        return redirect()->route('stock-transfers.index')
            ->with('success', 'Transfer request cancelled.');
    }

    // ──────────────────────────────────────────────────────
    // PRIVATE: Move stock
    // ──────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// Replace the entire moveStock() private method in StockTransferController
// ─────────────────────────────────────────────────────────────────────
 
private function moveStock(StockTransfer $stockTransfer): void
{
    foreach ($stockTransfer->items as $item) {
        $qtyToMove = $item->effective_qty;
 
        // ── STEP 1: Deduct from SOURCE lot ────────────────────────────
        $sourceLot = ProductQty::findOrFail($item->products_qty_id);
        $sourceLot->decrement('quantity', $qtyToMove);

        InventoryStockService::afterBatchQuantityChange($sourceLot->fresh());
 
        // ── STEP 2: Find or CREATE product in DESTINATION branch ──────
        // If the medicine doesn't exist yet in the destination branch,
        // create it as a copy of the source product (same details, new branch_id)
        $sourceProduct = MedicineProduct::findOrFail($item->product_id);
 
        $destProduct = MedicineProduct::firstOrCreate(
            // Match by these fields — uniquely identifies the same medicine per branch
            [
                'branch_id'  => $stockTransfer->to_branch_id,
                'med_name'   => $sourceProduct->med_name,
                'dose'       => $sourceProduct->dose,
                'form'       => $sourceProduct->form,
                'brand_name' => $sourceProduct->brand_name,
            ],
            // If not found, create it with these values copied from source
            [
                'pack_size'       => $sourceProduct->pack_size,
                'retail_price'    => $sourceProduct->retail_price,
                'wholesale_price' => $sourceProduct->wholesale_price,
                'status'          => 'Active',
            ]
        );
 
        // ── STEP 3: Insert or UPDATE lot in DESTINATION products_qty ──
        // Same lot_number = same physical batch; preserve lot + expiry integrity
        $destLot = ProductQty::where('product_id', $destProduct->id)
            ->where('lot_number', $item->lot_number)
            ->first();
 
        if ($destLot) {
            // Lot already exists in destination → just add quantity
            $destLot->increment('quantity', $qtyToMove);
 
            // Re-activate if it was marked Inactive (e.g. previously zeroed out)
            if ($destLot->status !== 'Active') {
                $destLot->update(['status' => 'Active']);
            }
        } else {
            // Lot doesn't exist in destination → insert new row
            ProductQty::create([
                'product_id' => $destProduct->id,
                'quantity'   => $qtyToMove,
                'status'     => 'Active',
                'lot_number' => $item->lot_number,
                'expiry'     => $item->expiry,  // preserve original expiry date
            ]);
        }
    }
 
    // ── Log the movement ──────────────────────────────────────────────
    StockTransferLog::create([
        'stock_transfer_id' => $stockTransfer->id,
        'action'            => 'stock_moved',
        'performed_by'      => auth()->id(),
        'note'              => 'Stock quantities updated automatically upon approval.',
    ]);
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

