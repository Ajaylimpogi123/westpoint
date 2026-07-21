<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockIn;
use App\Models\StockOut;
use App\Services\InventoryMovementLogger;
use App\Services\InventoryStockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MedicineInventoryController extends Controller
{
    private const MEDICINE_DETAIL_FIELDS = [
        'med_name',
        'dose',
        'form',
        'pack_size',
        'brand_name',
        'is_generic',
        'retail_price',
        'stock_threshold',
        'wholesale_price',
    ];

    public function index(Request $request): Response
    {
        $branchId = $this->branchId();
        $search = $request->input('search');
        $status = $request->input('status', 'Active');
        $stockLevel = $request->input('stock_level', 'all');
        $form = $request->input('form');
        $genericOnly = $request->boolean('generic_only');

        $medicines = MedicineProduct::query()
            ->when($branchId, fn ($query) => $query->forBranch($branchId))
            ->stockLevel($stockLevel)
            ->when($branchId, function ($query) {
                $query
                    ->withSum(['batches as total_stock' => function ($batchQuery) {
                        $batchQuery->available();
                    }], 'quantity')
                    ->with(['batches' => function ($batchQuery) {
                        $batchQuery
                            ->where('status', '!=', 'Deleted')
                            ->orderBy('expiry')
                            ->select(['id', 'product_id', 'lot_number', 'expiry', 'shelf_number', 'quantity', 'status']);
                    }]);
            })
            ->when($search, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('med_name', 'like', "%{$search}%")
                        ->orWhere('brand_name', 'like', "%{$search}%")
                        ->orWhere('dose', 'like', "%{$search}%")
                        ->orWhere('form', 'like', "%{$search}%");
                });
            })
            ->when($status && $status !== 'all', function ($query) use ($status) {
                $query->where('tbl_products.status', $status);
            })
            ->when($form, function ($query) use ($form) {
                $query->where('form', $form);
            })
            ->when($genericOnly, function ($query) {
                $query->where('is_generic', true);
            })
            ->orderBy('med_name')
            ->paginate(10)
            ->withQueryString();

        $roleId = (int) session('role_id');
        $branchName = $branchId
            ? Branch::query()->whereKey($branchId)->value('branch_name')
            : null;

        $products = $branchId
            ? MedicineProduct::query()
                ->active()
                ->forBranch($branchId)
                ->with(['batches' => function ($batchQuery) {
                    $batchQuery
                        ->available()
                        ->orderBy('expiry')
                        ->select(['id', 'product_id', 'lot_number', 'expiry', 'shelf_number', 'quantity']);
                }])
                ->orderBy('med_name')
                ->get([
                    'id',
                    'med_name',
                    'brand_name',
                    'dose',
                    'form',
                    'retail_price',
                    'wholesale_price',
                    'pack_size',
                    'stock_threshold',
                ])
            : collect();

        $stockInPerPage = (int) $request->input('stock_in_per_page', 10);
        $stockInPerPage = in_array($stockInPerPage, [10, 15, 25, 50], true)
            ? $stockInPerPage
            : 10;

        $stockOutPerPage = (int) $request->input('stock_out_per_page', 10);
        $stockOutPerPage = in_array($stockOutPerPage, [10, 15, 25, 50], true)
            ? $stockOutPerPage
            : 10;

        $stockIns = $branchId
            ? StockIn::query()
                ->where('branch_id', $branchId)
                ->orderByDesc('delivery_date')
                ->orderByDesc('stock_in_id')
                ->paginate(
                    $stockInPerPage,
                    ['stock_in_id', 'supplier_name', 'delivery_date', 'received_by'],
                    'stock_in_page'
                )
                ->withQueryString()
            : null;

        $stockOuts = $branchId
            ? StockOut::query()
                ->where('branch_id', $branchId)
                ->orderByDesc('created_at')
                ->orderByDesc('stock_out_id')
                ->paginate(
                    $stockOutPerPage,
                    ['stock_out_id', 'transaction_subtype', 'issued_by', 'patient_reference', 'delivery_confirmed', 'created_at'],
                    'stock_out_page'
                )
                ->withQueryString()
            : null;

        $movementLogPerPage = (int) $request->input('movement_log_per_page', 15);
        $movementLogPerPage = in_array($movementLogPerPage, [10, 15, 25, 50], true)
            ? $movementLogPerPage
            : 15;

        $movementLogs = $branchId
            ? InventoryMovementLog::query()
                ->where('branch_id', $branchId)
                ->with('performer:id,name')
                ->orderByDesc('created_at')
                ->orderByDesc('log_id')
                ->paginate($movementLogPerPage, ['*'], 'movement_log_page')
                ->withQueryString()
            : null;

        return Inertia::render('MedicineInventory/Index', [
            'medicines' => $medicines,
            'filters' => $request->only([
                'search',
                'status',
                'stock_level',
                'form',
                'generic_only',
                'movement_log_per_page',
                'stock_in_per_page',
                'stock_out_per_page',
            ]),
            'branchId' => $branchId,
            'branchName' => $branchName,
            'products' => $products,
            'stockIns' => $stockIns,
            'stockOuts' => $stockOuts,
            'movementLogs' => $movementLogs,
            'canEditMedicine' => in_array($roleId, [2, 3], true),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'med_name' => ['required', 'string', 'max:244'],
            'dose' => ['nullable', 'string', 'max:100'],
            'form' => ['nullable', 'string', 'max:100'],
            'pack_size' => ['required', 'integer', 'min:1'],
            'brand_name' => ['nullable', 'string', 'max:244'],
            'is_generic' => ['sometimes', 'boolean'],
            'retail_price' => ['required', 'numeric', 'min:0'],
            'stock_threshold' => ['nullable', 'integer', 'min:0'],
            'wholesale_price' => ['required', 'numeric', 'min:0'],
        ]);

        $medicine = MedicineProduct::create([
            ...$validated,
            'branch_id' => $branchId,
            'status' => 'Active',
        ]);

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_MEDICINE_ADDED,
            referenceLabel: "Medicine #{$medicine->id}",
            referenceId: $medicine->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            remarks: $medicine->brand_name
                ? "Brand: {$medicine->brand_name}"
                : null,
            metadata: [
                'snapshot' => InventoryMovementLogger::snapshotFields(
                    $medicine->toArray(),
                    self::MEDICINE_DETAIL_FIELDS,
                ),
            ],
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Medicine added successfully.');
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $medicine = $this->findBranchMedicineOrFail($id, $this->branchIdOrFail());

        $validated = $request->validate([
            'med_name' => ['required', 'string', 'max:244'],
            'dose' => ['nullable', 'string', 'max:100'],
            'form' => ['nullable', 'string', 'max:100'],
            'pack_size' => ['required', 'integer', 'min:1'],
            'brand_name' => ['nullable', 'string', 'max:244'],
            'is_generic' => ['sometimes', 'boolean'],
            'retail_price' => ['required', 'numeric', 'min:0'],
            'stock_threshold' => ['nullable', 'integer', 'min:0'],
            'wholesale_price' => ['required', 'numeric', 'min:0'],
        ]);

        $before = $medicine->only(self::MEDICINE_DETAIL_FIELDS);

        $medicine->update($validated);

        $medicine->refresh();

        $changes = InventoryMovementLogger::diffFields(
            $before,
            $medicine->only(self::MEDICINE_DETAIL_FIELDS),
            self::MEDICINE_DETAIL_FIELDS,
        );

        InventoryMovementLogger::log(
            branchId: $this->branchIdOrFail(),
            movementType: InventoryMovementLog::TYPE_MEDICINE_UPDATED,
            referenceLabel: "Medicine #{$medicine->id}",
            referenceId: $medicine->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            remarks: $changes
                ? 'Medicine details updated.'
                : 'Medicine saved with no field changes.',
            metadata: ['changes' => $changes],
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Medicine updated successfully.');
    }

    public function destroy(int $id): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();
        $medicine = $this->findBranchMedicineOrFail($id, $branchId);
        $medicine->softDelete();

        ProductQty::where('product_id', $medicine->id)
            ->where('status', 'Active')
            ->update(['status' => 'Inactive']);

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_MEDICINE_DELETED,
            referenceLabel: "Medicine #{$medicine->id}",
            referenceId: $medicine->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            remarks: 'Medicine deactivated.',
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Medicine has been deactivated.');
    }

    public function storeStock(Request $request): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'boxes_received' => ['required', 'integer', 'min:1'],
            'lot_number' => ['nullable', 'string', 'max:100'],
            'expiry' => ['nullable', 'date'],
            'shelf_number' => ['nullable', 'string', 'max:50'],
        ]);

        $medicine = MedicineProduct::active()
            ->forBranch($branchId)
            ->findOrFail($validated['product_id']);
        $quantityInPieces = $validated['boxes_received'] * $medicine->pack_size;

        InventoryStockService::addStock(
            productId: $medicine->id,
            branchId: $branchId,
            quantityInPieces: $quantityInPieces,
            lotNumber: $validated['lot_number'] ?? null,
            expiry: $validated['expiry'] ?? null,
            shelfNumber: $validated['shelf_number'] ?? null,
        );

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_ADD_STOCK,
            referenceLabel: "Medicine #{$medicine->id}",
            referenceId: $medicine->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            lotNumber: $validated['lot_number'] ?? null,
            quantity: $quantityInPieces,
            remarks: "{$validated['boxes_received']} box(es) added manually.",
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', "Stock added: {$validated['boxes_received']} box(es) ({$quantityInPieces} pieces).");
    }

    public function updateBatch(Request $request, int $id): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();
        $batch = $this->findBranchBatchOrFail($id, $branchId);

        $validated = $request->validate([
            'lot_number' => ['nullable', 'string', 'max:100'],
            'expiry' => ['nullable', 'date'],
            'boxes_received' => ['required', 'integer', 'min:0'],
            'shelf_number' => ['nullable', 'string', 'max:50'],
        ]);

        $medicine = MedicineProduct::findOrFail($batch->product_id);
        $quantityInPieces = $validated['boxes_received'] * $medicine->pack_size;

        $batchFields = ['lot_number', 'expiry', 'quantity', 'shelf_number'];
        $before = [
            'lot_number' => $batch->lot_number,
            'expiry' => $batch->expiry?->format('Y-m-d'),
            'quantity' => $batch->quantity,
            'shelf_number' => $batch->shelf_number,
        ];

        $batch->update([
            'lot_number' => $validated['lot_number'] ?? null,
            'expiry' => $validated['expiry'] ?? null,
            'quantity' => $quantityInPieces,
            'shelf_number' => $validated['shelf_number'] ?? null,
        ]);

        InventoryStockService::afterBatchQuantityChange($batch);

        $batch->refresh();

        $after = [
            'lot_number' => $batch->lot_number,
            'expiry' => $batch->expiry?->format('Y-m-d'),
            'quantity' => $batch->quantity,
            'shelf_number' => $batch->shelf_number,
        ];

        $changes = InventoryMovementLogger::diffFields($before, $after, $batchFields);

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_BATCH_UPDATED,
            referenceLabel: "Batch #{$batch->id}",
            referenceId: $batch->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            lotNumber: $validated['lot_number'] ?? null,
            quantity: $quantityInPieces,
            remarks: 'Batch quantity or lot details updated.',
            metadata: ['changes' => $changes],
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Batch updated successfully.');
    }

    public function destroyBatch(int $id): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();
        $batch = $this->findBranchBatchOrFail($id, $branchId);

        $medicine = MedicineProduct::findOrFail($batch->product_id);

        $batch->update(['status' => 'Deleted']);

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_BATCH_DELETED,
            referenceLabel: "Batch #{$batch->id}",
            referenceId: $batch->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            lotNumber: $batch->lot_number,
            quantity: $batch->quantity,
            remarks: 'Batch removed from inventory.',
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Batch has been removed.');
    }

    public function restore(int $id): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();
        $medicine = $this->findBranchMedicineOrFail($id, $branchId);

        if ($medicine->status !== 'Deleted') {
            return redirect()->route('medicine-inventory.index')
                ->with('error', 'Only deactivated medicines can be restored.');
        }

        if (InventoryStockService::totalAvailableStock($medicine->id) <= 0) {
            return redirect()->route('medicine-inventory.index')
                ->with('error', 'Add stock before restoring this medicine.');
        }

        $medicine->reactivate();

        InventoryMovementLogger::log(
            branchId: $branchId,
            movementType: InventoryMovementLog::TYPE_MEDICINE_REACTIVATED,
            referenceLabel: "Medicine #{$medicine->id}",
            referenceId: $medicine->id,
            pdId: $medicine->id,
            medicineName: $medicine->med_name,
            remarks: 'Medicine manually restored.',
        );

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Medicine has been restored.');
    }

    private function branchId(): ?int
    {
        $branchId = session('branch_id');

        return $branchId ? (int) $branchId : null;
    }

    private function branchIdOrFail(): int
    {
        $branchId = $this->branchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }

    private function findBranchMedicineOrFail(int $id, int $branchId): MedicineProduct
    {
        return MedicineProduct::query()
            ->where('id', $id)
            ->forBranch($branchId)
            ->firstOrFail();
    }

    private function findBranchBatchOrFail(int $id, int $branchId): ProductQty
    {
        return ProductQty::query()
            ->where('id', $id)
            ->where('status', '!=', 'Deleted')
            ->whereHas('product', fn ($query) => $query->forBranch($branchId))
            ->firstOrFail();
    }
}
