<?php

namespace App\Http\Controllers;

use App\Models\BranchCustomer;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\Quotation;
use App\Models\QuotationItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Inertia\Inertia;
use Inertia\Response;

class QuotationController extends Controller
{
    // ──────────────────────────────────────────────────────
    // INDEX — paginated list of all quotations
    // ──────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $search = $request->get('search');
        $status = $request->get('status', 'all');

        $quotations = Quotation::with(['customer', 'items'])
            ->when($search, function ($q) use ($search) {
                $q->where('qt_no', 'like', "%{$search}%")
                  ->orWhereHas('customer', fn ($c) =>
                        $c->where('first_name', 'like', "%{$search}%")
                          ->orWhere('last_name', 'like', "%{$search}%")
                  );
            })
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Quotation/Index', [
            'quotations' => $quotations,
            'filters'    => ['search' => $search, 'status' => $status],
        ]);
    }

    // ──────────────────────────────────────────────────────
    // CREATE — blank quotation form
    // ──────────────────────────────────────────────────────

    public function create(): Response
    {
        return Inertia::render('Quotation/Create', [
            'nextQtNo' => Quotation::generateQtNo(),
        ]);
    }

    // ──────────────────────────────────────────────────────
    // STORE — save new quotation + items
    // ──────────────────────────────────────────────────────

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'customer_id'                  => ['required', 'integer', $this->customerExistsRule()],
            'sid_no'                       => 'nullable|string|max:100',
            'qt_date'                      => 'required|date',
            'address'                      => 'nullable|string|max:255',
            'delivery_type'                => 'required|in:pick-up,delivery',
            'qt_remarks'                   => 'nullable|string',
            'checked_by'                   => 'nullable|string|max:100',
            'prepared_by'                  => 'nullable|string|max:100',

            // Line items
            'items'                        => 'required|array|min:1',
            'items.*.qt_qty'               => 'required|integer|min:1',
            'items.*.qt_unit'              => 'nullable|string|max:50',
            'items.*.qt_description'       => 'required|string',
            'items.*.lot_number'           => 'nullable|string|max:100',
            'items.*.expiry_date'          => 'nullable|date',
            'items.*.qt_unit_price'        => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($validated) {
            $quotation = Quotation::create([
                'customer_id'   => $validated['customer_id'],
                'qt_no'         => Quotation::generateQtNo(),
                'sid_no'        => $validated['sid_no'] ?? null,
                'qt_date'       => $validated['qt_date'],
                'address'       => $validated['address'] ?? null,
                'delivery_type' => $validated['delivery_type'],
                'qt_remarks'    => $validated['qt_remarks'] ?? null,
                'checked_by'    => $validated['checked_by'] ?? null,
                'prepared_by'   => $validated['prepared_by'] ?? null,
                'status'        => 'draft',
                'total_amount'  => 0,
            ]);

            foreach ($validated['items'] as $index => $item) {
                QuotationItem::create([
                    'quotation_id'   => $quotation->id,
                    'qt_qty'         => $item['qt_qty'],
                    'qt_unit'        => $item['qt_unit'] ?? null,
                    'qt_description' => $item['qt_description'],
                    'lot_number'     => $item['lot_number'] ?? null,
                    'expiry_date'    => $item['expiry_date'] ?? null,
                    'qt_unit_price'  => $item['qt_unit_price'],
                    'sort_order'     => $index,
                ]);
            }
        });

        return redirect()->route('quotations.index')
            ->with('success', 'Quotation created successfully.');
    }

    // ──────────────────────────────────────────────────────
    // SHOW — view one quotation with all items
    // ──────────────────────────────────────────────────────

    public function show(Quotation $quotation): Response
    {
        $quotation->load(['customer', 'items']);

        return Inertia::render('Quotation/Show', [
            'quotation' => $quotation,
        ]);
    }

    // ──────────────────────────────────────────────────────
    // EDIT — pre-filled form
    // ──────────────────────────────────────────────────────

    public function edit(Quotation $quotation): Response
    {
        $quotation->load(['customer', 'items']);

        return Inertia::render('Quotation/Edit', [
            'quotation' => $quotation,
        ]);
    }

    // ──────────────────────────────────────────────────────
    // UPDATE — replace header + items
    // ──────────────────────────────────────────────────────

    public function update(Request $request, Quotation $quotation): RedirectResponse
    {
        if (! $quotation->isDraft()) {
            return back()->withErrors(['status' => 'Only draft quotations can be edited.']);
        }

        $validated = $request->validate([
            'customer_id'            => ['required', 'integer', $this->customerExistsRule()],
            'sid_no'                 => 'nullable|string|max:100',
            'qt_date'                => 'required|date',
            'address'                => 'nullable|string|max:255',
            'delivery_type'          => 'required|in:pick-up,delivery',
            'qt_remarks'             => 'nullable|string',
            'checked_by'             => 'nullable|string|max:100',
            'prepared_by'            => 'nullable|string|max:100',
            'items'                  => 'required|array|min:1',
            'items.*.qt_qty'         => 'required|integer|min:1',
            'items.*.qt_unit'        => 'nullable|string|max:50',
            'items.*.qt_description' => 'required|string',
            'items.*.lot_number'     => 'nullable|string|max:100',
            'items.*.expiry_date'    => 'nullable|date',
            'items.*.qt_unit_price'  => 'required|numeric|min:0',
        ]);

        DB::transaction(function () use ($validated, $quotation) {
            $quotation->update([
                'customer_id'   => $validated['customer_id'],
                'sid_no'        => $validated['sid_no'] ?? null,
                'qt_date'       => $validated['qt_date'],
                'address'       => $validated['address'] ?? null,
                'delivery_type' => $validated['delivery_type'],
                'qt_remarks'    => $validated['qt_remarks'] ?? null,
                'checked_by'    => $validated['checked_by'] ?? null,
                'prepared_by'   => $validated['prepared_by'] ?? null,
            ]);

            $quotation->items()->delete();

            foreach ($validated['items'] as $index => $item) {
                QuotationItem::create([
                    'quotation_id'   => $quotation->id,
                    'qt_qty'         => $item['qt_qty'],
                    'qt_unit'        => $item['qt_unit'] ?? null,
                    'qt_description' => $item['qt_description'],
                    'lot_number'     => $item['lot_number'] ?? null,
                    'expiry_date'    => $item['expiry_date'] ?? null,
                    'qt_unit_price'  => $item['qt_unit_price'],
                    'sort_order'     => $index,
                ]);
            }
        });

        return redirect()->route('quotations.show', $quotation)
            ->with('success', 'Quotation updated successfully.');
    }

    // ──────────────────────────────────────────────────────
    // DESTROY — delete a draft quotation
    // ──────────────────────────────────────────────────────

    public function destroy(Quotation $quotation): RedirectResponse
    {
        if (! $quotation->isDraft()) {
            return back()->withErrors(['status' => 'Only draft quotations can be deleted.']);
        }

        $quotation->delete();

        return redirect()->route('quotations.index')
            ->with('success', 'Quotation deleted.');
    }

    // ──────────────────────────────────────────────────────
    // PRINT — full-page printable slip (like TransferSlip)
    // ──────────────────────────────────────────────────────

    public function print(Quotation $quotation): Response
    {
        $quotation->load(['customer', 'items']);

        $quotation->update([
            'printed_by'   => auth()->user()->name,
            'time_printed' => now()->format('m-d-Y h:i A'),
        ]);

        return Inertia::render('Quotation/Print', [
            'quotation' => $quotation,
        ]);
    }

    // ──────────────────────────────────────────────────────
    // MEDICINE SEARCH — branch-scoped product lookup for item rows
    // ──────────────────────────────────────────────────────

    public function searchMedicines(Request $request): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'search' => ['required', 'string', 'min:1', 'max:255'],
        ]);

        $search = trim($validated['search']);

        $products = $this->branchMedicinesQuery($branchId)
            ->where(function ($query) use ($search) {
                $query->where('med_name', 'like', "%{$search}%")
                    ->orWhere('brand_name', 'like', "%{$search}%")
                    ->orWhere('dose', 'like', "%{$search}%")
                    ->orWhere('form', 'like', "%{$search}%");
            })
            ->orderBy('med_name')
            ->limit(20)
            ->get([
                'id',
                'med_name',
                'brand_name',
                'dose',
                'form',
            ])
            ->map(fn (MedicineProduct $product) => $this->serializeMedicineSummary($product));

        return response()->json(['products' => $products]);
    }

    public function showMedicine(MedicineProduct $product): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $product->branch_id !== $branchId || $product->status !== 'Active') {
            abort(404);
        }

        if (! $product->batches()->available()->exists()) {
            abort(404);
        }

        $product->load(['batches' => function ($query) {
            $query->available()
                ->orderByRaw('CASE WHEN expiry IS NULL THEN 1 ELSE 0 END')
                ->orderBy('expiry')
                ->select(['id', 'product_id', 'lot_number', 'expiry', 'quantity']);
        }]);

        return response()->json($this->serializeMedicineForQuotation($product));
    }

    // ──────────────────────────────────────────────────────
    // UPDATE STATUS — send / approve / cancel
    // ──────────────────────────────────────────────────────

    public function updateStatus(Request $request, Quotation $quotation): RedirectResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:sent,approved,cancelled',
        ]);

        $quotation->update(['status' => $validated['status']]);

        $label = ucfirst($validated['status']);

        return back()->with('success', "Quotation marked as {$label}.");
    }

    private function roleId(): int
    {
        return (int) session('role_id');
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

    private function customerExistsRule(): Exists
    {
        $rule = Rule::exists('tbl_customers', 'customer_id')
            ->where('status', 'active');

        if ($this->roleId() !== 2) {
            $rule->where('branch_id', $this->branchIdOrFail());
        }

        return $rule;
    }

    private function branchMedicinesQuery(int $branchId)
    {
        return MedicineProduct::query()
            ->active()
            ->forBranch($branchId)
            ->whereHas('batches', function ($batchQuery) {
                $batchQuery->available();
            });
    }

    private function serializeMedicineSummary(MedicineProduct $product): array
    {
        return [
            'id' => $product->id,
            'med_name' => $product->med_name,
            'brand_name' => $product->brand_name,
            'dose' => $product->dose,
            'form' => $product->form,
            'label' => $this->formatMedicineDescription($product),
        ];
    }

    private function serializeMedicineForQuotation(MedicineProduct $product): array
    {
        $lots = $product->batches
            ->map(fn (ProductQty $batch) => [
                'id' => $batch->id,
                'lot_number' => $batch->lot_number,
                'expiry' => $batch->expiry?->toDateString(),
                'quantity' => (int) $batch->quantity,
            ])
            ->values()
            ->all();

        $primaryLot = $lots[0] ?? null;

        return [
            'id' => $product->id,
            'med_name' => $product->med_name,
            'brand_name' => $product->brand_name,
            'dose' => $product->dose,
            'form' => $product->form,
            'pack_size' => (int) $product->pack_size,
            'retail_price' => (string) $product->retail_price,
            'wholesale_price' => (string) $product->wholesale_price,
            'description' => $this->formatMedicineDescription($product),
            'default_unit' => 'PIECE',
            'default_price' => (string) $product->retail_price,
            'lots' => $lots,
            'primary_lot' => $primaryLot,
        ];
    }

    private function formatMedicineDescription(MedicineProduct $product): string
    {
        $namePart = trim(implode(' ', array_filter([
            $product->med_name,
            $product->dose,
        ])));

        $description = $product->form
            ? "{$product->form} - {$namePart}"
            : $namePart;

        if ($product->brand_name) {
            $description .= " ({$product->brand_name})";
        }

        return $description;
    }
}
