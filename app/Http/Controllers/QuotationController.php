<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Quotation;
use App\Models\QuotationItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
                  ->orWhereHas('customer', fn($c) =>
                        $c->where('cust_name', 'like', "%{$search}%")
                  );
            })
            ->when($status !== 'all', fn($q) => $q->where('status', $status))
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
            'customers' => Customer::orderBy('cust_name')
                                   ->get(['cust_id', 'cust_name', 'address', 'tin']),
            'nextQtNo'  => Quotation::generateQtNo(),
        ]);
    }

    // ──────────────────────────────────────────────────────
    // STORE — save new quotation + items
    // ──────────────────────────────────────────────────────

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'cust_id'                      => 'required|exists:tbl_customer,cust_id',
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
                'cust_id'       => $validated['cust_id'],
                'qt_no'         => Quotation::generateQtNo(),
                'sid_no'        => $validated['sid_no'] ?? null,
                'qt_date'       => $validated['qt_date'],
                'address'       => $validated['address'] ?? null,
                'delivery_type' => $validated['delivery_type'],
                'qt_remarks'    => $validated['qt_remarks'] ?? null,
                'checked_by'    => $validated['checked_by'] ?? null,
                'prepared_by'   => $validated['prepared_by'] ?? null,
                'status'        => 'draft',
                'total_amount'  => 0, // recalculated after items are saved
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
                    // amount is auto-computed in QuotationItem::boot()
                ]);
            }
            // total_amount is auto-recalculated via QuotationItem::saved() observer
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
            'customers' => Customer::orderBy('cust_name')
                                   ->get(['cust_id', 'cust_name', 'address', 'tin']),
        ]);
    }

    // ──────────────────────────────────────────────────────
    // UPDATE — replace header + items
    // ──────────────────────────────────────────────────────

    public function update(Request $request, Quotation $quotation): RedirectResponse
    {
        // Only draft quotations can be edited
        if (! $quotation->isDraft()) {
            return back()->withErrors(['status' => 'Only draft quotations can be edited.']);
        }

        $validated = $request->validate([
            'cust_id'                => 'required|exists:tbl_customer,cust_id',
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
            // Update header
            $quotation->update([
                'cust_id'       => $validated['cust_id'],
                'sid_no'        => $validated['sid_no'] ?? null,
                'qt_date'       => $validated['qt_date'],
                'address'       => $validated['address'] ?? null,
                'delivery_type' => $validated['delivery_type'],
                'qt_remarks'    => $validated['qt_remarks'] ?? null,
                'checked_by'    => $validated['checked_by'] ?? null,
                'prepared_by'   => $validated['prepared_by'] ?? null,
            ]);

            // Replace all items (delete old, insert new)
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

        // Items cascade-delete via foreign key onDelete('cascade')
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

        // Record who printed it and when
        $quotation->update([
            'printed_by'   => auth()->user()->name,
            'time_printed' => now()->format('m-d-Y h:i A'),
        ]);

        return Inertia::render('Quotation/Print', [
            'quotation' => $quotation,
        ]);
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
}