<?php

namespace App\Http\Controllers;

use App\Enums\UnitType;
use App\Exceptions\InsufficientStockException;
use App\Exceptions\InvalidPackSizeException;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockOut;
use App\Models\StockOutItem;
use App\Models\InventoryMovementLog;
use App\Services\IdempotencyGuard;
use App\Services\InventoryMovementLogger;
use App\Services\InventoryStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StockOutController extends Controller
{
    private const MAX_QUANTITY = InventoryStockService::MAX_TRANSACTION_QUANTITY;

    public function store(Request $request): RedirectResponse
    {
        $sessionBranchId = $this->branchIdOrFail();
        $canAssignBranch = $this->canAssignBranch();

        $validated = $request->validate([
            'transaction_subtype' => ['required', 'string', Rule::in([
                'Dispensed to patient',
                'Returned to supplier',
            ])],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'patient_reference' => ['nullable', 'string', 'max:255'],
            'issued_by' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'delivered_to' => ['nullable', 'string', 'max:255'],
            'delivered_to_address' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.pd_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.products_qty_id' => ['required', 'integer', 'exists:products_qty,id'],
            'items.*.quantity_deducted' => ['required', 'integer', 'min:1', 'max:' . self::MAX_QUANTITY],
            'items.*.unit_type' => ['required', 'string', Rule::in(UnitType::values())],
        ]);

        $branchId = $canAssignBranch
            ? (int) $validated['branch_id']
            : $sessionBranchId;

        if (! $canAssignBranch && (int) $validated['branch_id'] !== $sessionBranchId) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'The source branch does not match your session branch.');
        }

        $idempotencyKey = $request->input('idempotency_key');

        if (! IdempotencyGuard::claim(IdempotencyGuard::SCOPE_STOCK_OUT, $idempotencyKey)) {
            return redirect()->route('medicine-inventory.index')
                ->with('success', 'This stock-out was already saved.');
        }

        try {
            DB::transaction(function () use ($validated, $branchId) {
                $stockOut = StockOut::create([
                    'transaction_subtype' => $validated['transaction_subtype'],
                    'branch_id' => $branchId,
                    'patient_reference' => $validated['patient_reference'] ?? null,
                    'issued_by' => $validated['issued_by'],
                    'remarks' => $validated['remarks'] ?? null,
                    'delivered_to' => $validated['delivered_to'] ?? null,
                    'delivered_to_address' => $validated['delivered_to_address'] ?? null,
                ]);

                foreach ($validated['items'] as $item) {
                    $medicine = MedicineProduct::query()
                        ->active()
                        ->forBranch($branchId)
                        ->findOrFail($item['pd_id']);

                    $unitType = UnitType::fromInput($item['unit_type']);

                    // Resolve the batch the operator actually selected rather
                    // than the first row sharing its lot number.
                    $batch = $this->resolveBatchOrFail(
                        (int) $item['products_qty_id'],
                        $medicine,
                    );

                    $quantity = (int) $item['quantity_deducted'];
                    $piecesToDeduct = $medicine->toPieces($quantity, $unitType);

                    InventoryStockService::deductFromBatch(
                        batchId: $batch->id,
                        quantityInPieces: $piecesToDeduct,
                        medicineName: $medicine->med_name,
                    );

                    StockOutItem::create([
                        'stock_out_id' => $stockOut->stock_out_id,
                        'pd_id' => $medicine->id,
                        'products_qty_id' => $batch->id,
                        'lot_number' => $batch->lot_number,
                        'quantity_deducted' => $quantity,
                        'pieces_deducted' => $piecesToDeduct,
                        'expiry' => $batch->expiry,
                        'unit_type' => $unitType->value,
                        'unit_price' => $unitType->isBox()
                            ? $medicine->wholesale_price
                            : $medicine->retail_price,
                    ]);

                    InventoryMovementLogger::log(
                        branchId: $branchId,
                        movementType: InventoryMovementLog::TYPE_STOCK_OUT,
                        referenceLabel: "Stock Out #{$stockOut->stock_out_id}",
                        referenceId: $stockOut->stock_out_id,
                        pdId: $medicine->id,
                        medicineName: $medicine->med_name,
                        lotNumber: $batch->lot_number,
                        quantity: -$piecesToDeduct,
                        remarks: $validated['remarks'] ?? $validated['transaction_subtype'],
                    );
                }
            });
        } catch (InvalidPackSizeException | InsufficientStockException | \RuntimeException $exception) {
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_STOCK_OUT, $idempotencyKey);

            return redirect()->back()
                ->withInput()
                ->with('error', $exception->getMessage());
        } catch (Throwable $exception) {
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_STOCK_OUT, $idempotencyKey);
            report($exception);

            return redirect()->back()
                ->withInput()
                ->with('error', 'Stock-out could not be saved. Please verify your entries and try again.');
        }

        return redirect()->back()
            ->with('success', 'Stock-out transaction recorded successfully.');
    }

    public function show(StockOut $stockOut): JsonResponse
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id);

        $stockOut->load([
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'stock_out_id',
                    'pd_id',
                    'products_qty_id',
                    'lot_number',
                    'quantity_deducted',
                    'pieces_deducted',
                    'expiry',
                    'unit_type',
                    'unit_price',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form',
        ]);

        return response()->json([
            'stock_out' => [
                'stock_out_id' => $stockOut->stock_out_id,
                'transaction_subtype' => $stockOut->transaction_subtype,
                'patient_reference' => $stockOut->patient_reference,
                'issued_by' => $stockOut->issued_by,
                'remarks' => $stockOut->remarks,
                'delivered_to' => $stockOut->delivered_to,
                'delivered_to_address' => $stockOut->delivered_to_address,
                'delivery_confirmed' => (bool) $stockOut->delivery_confirmed,
                'created_at' => $stockOut->created_at,
            ],
            'items' => $stockOut->items->map(function (StockOutItem $item) {
                return [
                    'item_id' => $item->item_id,
                    'lot_number' => $item->lot_number,
                    'quantity_deducted' => $item->quantity_deducted,
                    'pieces_deducted' => $item->pieces_deducted,
                    'expiry' => $item->expiry,
                    'unit_type' => $item->unit_type,
                    'unit_price' => $item->unit_price,
                    'product' => $item->product ? [
                        'med_name' => $item->product->med_name,
                        'brand_name' => $item->product->brand_name,
                        'dose' => $item->product->dose,
                        'form' => $item->product->form,
                    ] : null,
                ];
            }),
        ]);
    }

    public function receipt(StockOut $stockOut): Response
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id);

        $stockOut->load([
            'branch',
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'stock_out_id',
                    'pd_id',
                    'products_qty_id',
                    'lot_number',
                    'quantity_deducted',
                    'pieces_deducted',
                    'expiry',
                    'unit_type',
                    'unit_price',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form,pack_size,retail_price,wholesale_price',
        ]);

        return Inertia::render('MedicineInventory/StockOutReceipt', [
            'stockOut' => $stockOut,
        ]);
    }

    /**
     * Confirms the patient/recipient has received a "Dispensed to patient"
     * delivery and, only at that point, records it as a completed sale.
     * Kept as a separate step (instead of doing it at stock-out creation
     * time) so the delivery receipt can be printed and handed over first.
     */
    public function confirmDelivery(StockOut $stockOut): RedirectResponse
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id);

        if ($stockOut->transaction_subtype !== 'Dispensed to patient') {
            return redirect()->back()
                ->with('error', 'Only "Dispensed to patient" stock-outs can be added to sales.');
        }

        if ($stockOut->delivery_confirmed) {
            return redirect()->back()
                ->with('error', 'This stock-out has already been added to sales.');
        }

        try {
            $branchId = (int) $stockOut->branch_id;

            DB::transaction(function () use ($stockOut, $branchId) {
                $items = StockOutItem::query()
                    ->where('stock_out_id', $stockOut->stock_out_id)
                    ->with('product:id,med_name,retail_price,wholesale_price')
                    ->get();

                if ($items->isEmpty()) {
                    throw new \RuntimeException('This stock-out has no items to add to sales.');
                }

                $saleLineItems = [];

                foreach ($items as $item) {
                    $medicine = $item->product;

                    if (! $medicine) {
                        continue;
                    }

                    $unitType = UnitType::tryFromInput($item->unit_type) ?? UnitType::Piece;

                    // Prefer the price captured at dispense time. Falling back
                    // to the product's current price is only for rows written
                    // before unit_price existed.
                    $priceUsed = $item->unit_price !== null
                        ? (float) $item->unit_price
                        : (float) ($unitType->isBox()
                            ? $medicine->wholesale_price
                            : $medicine->retail_price);

                    $saleLineItems[] = [
                        'product_id' => $item->pd_id,
                        'products_qty_id' => $item->products_qty_id,
                        'unit_type' => $unitType->value,
                        'quantity_sold' => $item->quantity_deducted,
                        'price_used' => $priceUsed,
                        'total_price' => round($priceUsed * $item->quantity_deducted, 2),
                    ];
                }

                if ($saleLineItems === []) {
                    throw new \RuntimeException('This stock-out has no items to add to sales.');
                }

                $this->recordDispenseAsSale($stockOut, $branchId, $saleLineItems);

                $stockOut->update(['delivery_confirmed' => true]);
            });
        } catch (\RuntimeException $exception) {
            return redirect()->back()
                ->with('error', $exception->getMessage());
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->back()
                ->with('error', 'Could not add this stock-out to sales. Please try again.');
        }

        return redirect()->back()
            ->with('success', 'Delivery confirmed and added to sales.');
    }

    /**
     * @param  array<int, array{
     *     product_id: int,
     *     products_qty_id: ?int,
     *     unit_type: string,
     *     quantity_sold: int,
     *     price_used: float,
     *     total_price: float
     * }>  $saleLineItems
     */
    private function recordDispenseAsSale(
        StockOut $stockOut,
        int $branchId,
        array $saleLineItems
    ): void {
        $grossAmount = round(array_sum(array_column($saleLineItems, 'total_price')), 2);

        $customerName = $stockOut->patient_reference ?? $stockOut->delivered_to ?? null;
        $customerName = $customerName !== null ? trim($customerName) : null;

        $sale = Sale::create([
            'invoice_number' => $this->generateDispenseInvoiceNumber($stockOut->stock_out_id),
            'branch_id' => $branchId,
            'user_id' => auth()->id(),
            'customer_name' => $customerName !== '' ? $customerName : null,
            'customer_id' => null,
            'gross_amount' => $grossAmount,
            'discount_amount' => 0,
            'net_amount' => $grossAmount,
            'payment_method' => 'Dispensed to patient',
            'reference_number' => "Stock Out #{$stockOut->stock_out_id}",
        ]);

        foreach ($saleLineItems as $lineItem) {
            SaleItem::create([
                'sale_id' => $sale->id,
                'product_id' => $lineItem['product_id'],
                'products_qty_id' => $lineItem['products_qty_id'],
                'unit_type' => $lineItem['unit_type'],
                'quantity_sold' => $lineItem['quantity_sold'],
                'price_used' => $lineItem['price_used'],
                'total_price' => $lineItem['total_price'],
            ]);
        }
    }

    private function generateDispenseInvoiceNumber(int $stockOutId): string
    {
        return 'DISP-' . date('Ymd') . '-' . str_pad((string) $stockOutId, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Confirm the submitted batch belongs to the submitted product and is fit
     * to dispense. Validating ownership here rather than trusting the id
     * keeps a crafted payload from reaching stock in another branch.
     */
    private function resolveBatchOrFail(int $batchId, MedicineProduct $medicine): ProductQty
    {
        $batch = ProductQty::query()
            ->whereKey($batchId)
            ->where('product_id', $medicine->id)
            ->first();

        if (! $batch || $batch->isDeleted()) {
            throw new \RuntimeException(
                "The selected lot is no longer available for {$medicine->med_name}. Refresh and try again."
            );
        }

        if ($batch->isExpired()) {
            throw new \RuntimeException(
                "Lot {$batch->lot_number} of {$medicine->med_name} expired on "
                . $batch->expiry->format('d M Y') . ' and cannot be dispensed.'
            );
        }

        return $batch;
    }

    private function assertCanAccessBranchTransaction(int $transactionBranchId): void
    {
        if ($this->canAssignBranch()) {
            return;
        }

        $branchId = $this->branchIdOrFail();

        if ($transactionBranchId !== $branchId) {
            abort(403, 'You do not have access to this stock-out transaction.');
        }
    }

    private function canAssignBranch(): bool
    {
        return in_array((int) session('role_id'), [2, 3], true);
    }

    private function branchIdOrFail(): int
    {
        $branchId = session('branch_id');

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return (int) $branchId;
    }
}
