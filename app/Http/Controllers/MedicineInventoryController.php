<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MedicineInventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $status = $request->input('status', 'Active');

        $medicines = MedicineProduct::query()
            ->withSum(['quantities as total_quantity' => function ($query) {
                $query->where('status', 'Active');
            }], 'quantity')
            ->when($search, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('med_name', 'like', "%{$search}%")
                        ->orWhere('brand_name', 'like', "%{$search}%")
                        ->orWhere('dose', 'like', "%{$search}%")
                        ->orWhere('form', 'like', "%{$search}%");
                });
            })
            ->when($status && $status !== 'all', function ($query) use ($status) {
                $query->where('status', $status);
            })
            ->orderBy('med_name')
            ->paginate(10)
            ->withQueryString();

        $branches = Branch::orderBy('branch_name')->get(['id', 'branch_name']);

        return Inertia::render('MedicineInventory/Index', [
            'medicines' => $medicines,
            'branches' => $branches,
            'filters' => $request->only(['search', 'status']),
            'userBranchId' => Auth::user()?->branch_id,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
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
            'status' => 'Active',
        ]);

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Medicine added successfully.');
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $medicine = MedicineProduct::findOrFail($id);

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
        $medicine = MedicineProduct::findOrFail($id);
        $medicine->softDelete();

        ProductQty::where('product_id', $medicine->id)
            ->where('status', 'Active')
            ->update(['status' => 'Inactive']);

        return redirect()->route('medicine-inventory.index')
            ->with('success', 'Medicine has been deactivated.');
    }

    public function storeStock(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'boxes_received' => ['required', 'integer', 'min:1'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'lot_number' => ['nullable', 'string', 'max:100'],
            'expiry' => ['nullable', 'date'],
        ]);

        $medicine = MedicineProduct::active()->findOrFail($validated['product_id']);
        $quantityInPieces = $validated['boxes_received'] * $medicine->pack_size;

        ProductQty::create([
            'product_id' => $medicine->id,
            'quantity' => $quantityInPieces,
            'branch_id' => $validated['branch_id'],
            'status' => 'Active',
            'lot_number' => $validated['lot_number'] ?? null,
            'expiry' => $validated['expiry'] ?? null,
        ]);

        return redirect()->route('medicine-inventory.index')
            ->with('success', "Stock added: {$validated['boxes_received']} box(es) ({$quantityInPieces} pieces).");
    }
}
