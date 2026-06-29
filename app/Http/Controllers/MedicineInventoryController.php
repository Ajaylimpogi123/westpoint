<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\StockIn;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MedicineInventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $branchId = $this->branchId();
        $search = $request->input('search');
        $status = $request->input('status', 'Active');

        $medicines = MedicineProduct::query()
            ->when($branchId, fn ($query) => $query->forBranch($branchId))
            ->when($branchId, function ($query) {
                $query
                    ->withSum(['batches as total_stock' => function ($batchQuery) {
                        $batchQuery->where('status', '!=', 'Deleted');
                    }], 'quantity')
                    ->with(['batches' => function ($batchQuery) {
                        $batchQuery
                            ->where('status', '!=', 'Deleted')
                            ->orderBy('expiry')
                            ->select(['id', 'product_id', 'lot_number', 'expiry', 'quantity', 'status']);
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
                ])
            : collect();

        $stockIns = $branchId
            ? StockIn::query()
                ->where('branch_id', $branchId)
                ->orderByDesc('delivery_date')
                ->orderByDesc('stock_in_id')
                ->paginate(10, ['stock_in_id', 'supplier_name', 'delivery_date', 'received_by'], 'stock_in_page')
                ->withQueryString()
            : null;

        return Inertia::render('MedicineInventory/Index', [
            'medicines' => $medicines,
            'filters' => $request->only(['search', 'status']),
            'branchId' => $branchId,
            'branchName' => $branchName,
            'products' => $products,
            'stockIns' => $stockIns,
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
            'retail_price' => ['required', 'numeric', 'min:0'],
            'wholesale_price' => ['required', 'numeric', 'min:0'],
        ]);

        MedicineProduct::create([
            ...$validated,
            'branch_id' => $branchId,
            'status' => 'Active',
        ]);

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
            'retail_price' => ['required', 'numeric', 'min:0'],
            'wholesale_price' => ['required', 'numeric', 'min:0'],
        ]);

        $medicine->update($validated);

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
        ]);

        $medicine = MedicineProduct::active()
            ->forBranch($branchId)
            ->findOrFail($validated['product_id']);
        $quantityInPieces = $validated['boxes_received'] * $medicine->pack_size;

        ProductQty::create([
            'product_id' => $medicine->id,
            'quantity' => $quantityInPieces,
            'status' => 'Active',
            'lot_number' => $validated['lot_number'] ?? null,
            'expiry' => $validated['expiry'] ?? null,
        ]);

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
        ]);

        $medicine = MedicineProduct::findOrFail($batch->product_id);
        $quantityInPieces = $validated['boxes_received'] * $medicine->pack_size;

        $batch->update([
            'lot_number' => $validated['lot_number'] ?? null,
            'expiry' => $validated['expiry'] ?? null,
            'quantity' => $quantityInPieces,
        ]);

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Batch updated successfully.');
    }

    public function destroyBatch(int $id): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();
        $batch = $this->findBranchBatchOrFail($id, $branchId);

        $batch->update(['status' => 'Deleted']);

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Batch has been removed.');
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
