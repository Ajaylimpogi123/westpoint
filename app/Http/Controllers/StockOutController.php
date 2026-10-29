<?php

namespace App\Http\Controllers;

use App\Enums\UnitType;
use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Concerns\ResolvesTransactionBranch;
use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockOut;
use App\Models\StockOutItem;
use App\Services\IdempotencyGuard;
use App\Services\InventoryMovementLogger;
use App\Services\InventoryStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StockOutController extends Controller
{
    use ResolvesTransactionBranch;

    private const MAX_QUANTITY = InventoryStockService::MAX_TRANSACTION_QUANTITY;

    private const FORBIDDEN_MESSAGE = 'You do not have access to this stock-out transaction.';

    private const SUBTYPE_DELIVERY = 'Delivery to Customer';

    private const SUBTYPES = [self::SUBTYPE_DELIVERY, 'Returned to supplier'];

    /**
     * Philippine TIN: 9 digits (dashes optional) plus an optional 3-5 digit
     * branch code. Mirrored in the frontend; keep both in sync.
     */
    private const TIN_PATTERN = '/^\d{3}-?\d{3}-?\d{3}(?:-?\d{3,5})?$/';

    public function store(Request $request): RedirectResponse
    {
        // Only staff need a session branch; admins/superadmins pick any branch.
        $this->assertCanSubmitForAnyBranch();

        $idempotencyKey = is_string($request->input('idempotency_key'))
            ? $request->input('idempotency_key')
            : null;

        // A replay of a submission that was already saved must be reported
        // as saved, not re-validated against the stock it already took.
        if (IdempotencyGuard::isClaimed(IdempotencyGuard::SCOPE_STOCK_OUT, $idempotencyKey)) {
            return $this->alreadySaved();
        }

        $input = $this->normaliseInput($request->all());
        $isDelivery = ($input['transaction_subtype'] ?? null) === self::SUBTYPE_DELIVERY;
        $branchId = null;

        $validator = Validator::make($input, [
            'transaction_subtype' => ['required', 'string', Rule::in(self::SUBTYPES)],
            'branch_id' => $this->branchIdRules(),
            ...$this->headerRules(deliveredToRequired: $isDelivery),
            ...$this->itemRules(),
        ], $this->validationMessages());

        $validator->after(function ($validator) use ($input, &$branchId) {
            $errors = $validator->errors();

            if ($errors->has('branch_id')) {
                return;
            }

            $requestedBranchId = (int) $input['branch_id'];

            if (! $this->canAssignBranch() && $requestedBranchId !== $this->sessionBranchId()) {
                $errors->add('branch_id', 'You can only record transactions for your assigned branch.');

                return;
            }

            $branchId = $requestedBranchId;

            $this->addBasketErrors($validator, $input['items'] ?? [], $branchId);
        });

        // Every rule (header, lines, branch ownership, expiry, lot totals)
        // is checked before the key is claimed, so a rejected basket can be
        // fixed and resent with the same key.
        $validated = $validator->validate();

        // Atomic gate for two identical requests racing past isClaimed().
        if (! IdempotencyGuard::claim(IdempotencyGuard::SCOPE_STOCK_OUT, $idempotencyKey)) {
            return $this->alreadySaved();
        }

        try {
            DB::transaction(function () use ($validated, $branchId) {
                // Re-check under row locks: another transaction may have taken
                // stock from these lots since validation ran.
                [$errors, $lines] = $this->resolveBasket($validated['items'], $branchId, lockLots: true);

                if ($errors !== []) {
                    throw ValidationException::withMessages($errors);
                }

                $stockOut = StockOut::create([
                    'transaction_subtype' => $validated['transaction_subtype'],
                    'branch_id' => $branchId,
                    'patient_reference' => $validated['patient_reference'] ?? null,
                    'issued_by' => $validated['issued_by'],
                    'remarks' => $validated['remarks'] ?? null,
                    'delivered_to' => $validated['delivered_to'] ?? null,
                    'delivered_to_tin' => $validated['delivered_to_tin'] ?? null,
                    'delivered_to_address' => $validated['delivered_to_address'] ?? null,
                ]);

                foreach ($lines as $line) {
                    // "Delivery to Customer" takes no stock until the delivery
                    // is confirmed. "Returned to supplier" has no confirmation
                    // step, so it leaves the branch immediately.
                    if ($validated['transaction_subtype'] !== self::SUBTYPE_DELIVERY) {
                        InventoryStockService::deductFromBatch(
                            batchId: $line['batch']->id,
                            quantityInPieces: $line['pieces'],
                            medicineName: $line['medicine']->med_name,
                        );

                        InventoryMovementLogger::log(
                            branchId: $branchId,
                            movementType: InventoryMovementLog::TYPE_STOCK_OUT,
                            referenceLabel: "Stock Out #{$stockOut->stock_out_id}",
                            referenceId: $stockOut->stock_out_id,
                            pdId: $line['medicine']->id,
                            medicineName: $line['medicine']->med_name,
                            lotNumber: $line['batch']->lot_number,
                            quantity: -$line['pieces'],
                            remarks: $validated['remarks'] ?? $validated['transaction_subtype'],
                        );
                    }

                    $this->createItem($stockOut, $line);
                }
            });
        } catch (ValidationException $exception) {
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_STOCK_OUT, $idempotencyKey);

            throw $exception;
        } catch (InsufficientStockException|\RuntimeException $exception) {
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
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id, self::FORBIDDEN_MESSAGE);

        $stockOut->load([
            ...self::branchSummaryRelation(),
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
                    'pieces_per_box',
                    'unit_price',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form,pack_size',
        ]);

        return response()->json([
            'stock_out' => [
                'stock_out_id' => $stockOut->stock_out_id,
                'transaction_subtype' => $stockOut->transaction_subtype,
                'patient_reference' => $stockOut->patient_reference,
                'issued_by' => $stockOut->issued_by,
                'remarks' => $stockOut->remarks,
                'delivered_to' => $stockOut->delivered_to,
                'delivered_to_tin' => $stockOut->delivered_to_tin,
                'delivered_to_address' => $stockOut->delivered_to_address,
                'delivery_confirmed' => (bool) $stockOut->delivery_confirmed,
                'created_at' => $stockOut->created_at,
                'branch_id' => (int) $stockOut->branch_id,
                'branch' => self::branchSummary($stockOut->branch),
            ],
            'items' => $stockOut->items->map(function (StockOutItem $item) {
                return [
                    'item_id' => $item->item_id,
                    'lot_number' => $item->lot_number,
                    'quantity_deducted' => $item->quantity_deducted,
                    'pieces_deducted' => $item->pieces_deducted,
                    'expiry' => $item->expiry,
                    'unit_type' => $item->unit_type,
                    'pieces_per_box' => $item->pieces_per_box,
                    'unit_price' => $item->unit_price,
                    'product' => $item->product ? [
                        'med_name' => $item->product->med_name,
                        'brand_name' => $item->product->brand_name,
                        'dose' => $item->product->dose,
                        'form' => $item->product->form,
                        'pack_size' => $item->product->pack_size,
                    ] : null,
                ];
            }),
        ]);
    }

    public function receipt(StockOut $stockOut): Response
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id, self::FORBIDDEN_MESSAGE);

        $stockOut->load([
            ...self::branchSummaryRelation(),
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
                    'pieces_per_box',
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
     * Confirms the patient/recipient has received a "Delivery to Customer"
     * delivery and, only at that point, records it as a completed sale.
     * Kept as a separate step (instead of doing it at stock-out creation
     * time) so the delivery receipt can be printed and handed over first.
     */
    public function confirmDelivery(StockOut $stockOut): RedirectResponse
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id, self::FORBIDDEN_MESSAGE);

        if ($stockOut->transaction_subtype !== 'Delivery to Customer') {
            return redirect()->back()
                ->with('error', 'Only "Delivery to Customer" stock-outs can be added to sales.');
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

                    // The lot may have expired (or been removed) since the
                    // delivery was recorded; re-check before dispensing it.
                    $this->assertBatchDispensableForBranch((int) $item->products_qty_id, $medicine, $branchId);

                    // Deduct now, from the exact lot the operator selected when
                    // the stock-out was recorded (or last edited). pieces_deducted
                    // was already computed correctly at store/update time using
                    // the pieces-per-box entered then — nothing to recompute here.
                    InventoryStockService::deductFromBatch(
                        batchId: $item->products_qty_id,
                        quantityInPieces: $item->pieces_deducted,
                        medicineName: $medicine->med_name,
                    );

                    InventoryMovementLogger::log(
                        branchId: $branchId,
                        movementType: InventoryMovementLog::TYPE_STOCK_OUT,
                        referenceLabel: "Stock Out #{$stockOut->stock_out_id}",
                        referenceId: $stockOut->stock_out_id,
                        pdId: $medicine->id,
                        medicineName: $medicine->med_name,
                        lotNumber: $item->lot_number,
                        quantity: -$item->pieces_deducted,
                        remarks: $stockOut->remarks ?? $stockOut->transaction_subtype,
                    );

                    $unitType = UnitType::tryFromInput($item->unit_type) ?? UnitType::Piece;

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
        } catch (InsufficientStockException|\RuntimeException $exception) {
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

    public function edit(StockOut $stockOut): JsonResponse
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id, self::FORBIDDEN_MESSAGE);

        if (! $this->isEditable($stockOut)) {
            abort(403, 'This stock-out can no longer be edited.');
        }

        $stockOut->load([
            ...self::branchSummaryRelation(),
            'items' => function ($query) {
                $query->select([
                    'item_id', 'stock_out_id', 'pd_id', 'products_qty_id',
                    'lot_number', 'quantity_deducted', 'pieces_deducted',
                    'unit_type', 'pieces_per_box',
                ]);
            },
        ]);

        return response()->json([
            'stock_out' => [
                'stock_out_id' => $stockOut->stock_out_id,
                'transaction_subtype' => $stockOut->transaction_subtype,
                'branch_id' => (int) $stockOut->branch_id,
                'branch' => self::branchSummary($stockOut->branch),
                'patient_reference' => $stockOut->patient_reference,
                'issued_by' => $stockOut->issued_by,
                'remarks' => $stockOut->remarks,
                'delivered_to' => $stockOut->delivered_to,
                'delivered_to_tin' => $stockOut->delivered_to_tin,
                'delivered_to_address' => $stockOut->delivered_to_address,
            ],
            'items' => $stockOut->items->map(fn (StockOutItem $item) => [
                'pd_id' => $item->pd_id,
                'products_qty_id' => $item->products_qty_id,
                'lot_number' => $item->lot_number,
                'quantity_deducted' => $item->quantity_deducted,
                'pieces_deducted' => $item->pieces_deducted,
                // Legacy rows stored lowercase 'piece'/'box'.
                'unit_type' => UnitType::tryFromInput($item->unit_type)?->value ?? $item->unit_type,
                'pieces_per_box' => $item->pieces_per_box,
            ]),
        ]);
    }

    public function update(Request $request, StockOut $stockOut): RedirectResponse
    {
        $this->assertCanAccessBranchTransaction((int) $stockOut->branch_id, self::FORBIDDEN_MESSAGE);

        if (! $this->isEditable($stockOut)) {
            return redirect()->back()
                ->with('error', 'This stock-out can no longer be edited.');
        }

        // Items are checked against the stock-out's own branch, which is
        // fixed once recorded — never against the editor's session branch.
        $branchId = (int) $stockOut->branch_id;
        $input = $this->normaliseInput($request->all());

        // Only pending deliveries are editable, so delivered_to is required.
        $validator = Validator::make($input, [
            ...$this->headerRules(deliveredToRequired: true),
            ...$this->itemRules(),
        ], $this->validationMessages());

        $validator->after(function ($validator) use ($input, $branchId) {
            $this->addBasketErrors($validator, $input['items'] ?? [], $branchId);
        });

        $validated = $validator->validate();

        try {
            DB::transaction(function () use ($validated, $stockOut, $branchId) {
                // Nothing has been deducted yet for an editable stock-out, so
                // the lot's full current quantity is what is available.
                [$errors, $lines] = $this->resolveBasket($validated['items'], $branchId, lockLots: true);

                if ($errors !== []) {
                    throw ValidationException::withMessages($errors);
                }

                $stockOut->update([
                    'patient_reference' => $validated['patient_reference'] ?? null,
                    'issued_by' => $validated['issued_by'],
                    'remarks' => $validated['remarks'] ?? null,
                    'delivered_to' => $validated['delivered_to'] ?? null,
                    'delivered_to_tin' => $validated['delivered_to_tin'] ?? null,
                    'delivered_to_address' => $validated['delivered_to_address'] ?? null,
                ]);

                // No inventory to reverse — just replace the pending lines.
                StockOutItem::where('stock_out_id', $stockOut->stock_out_id)->delete();

                foreach ($lines as $line) {
                    $this->createItem($stockOut, $line);
                }
            });
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (InsufficientStockException|\RuntimeException $exception) {
            return redirect()->back()->withInput()->with('error', $exception->getMessage());
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->back()->withInput()
                ->with('error', 'Stock-out could not be updated. Please verify your entries and try again.');
        }

        return redirect()->back()->with('success', 'Stock-out transaction updated successfully.');
    }

    private function alreadySaved(): RedirectResponse
    {
        return redirect()->route('medicine-inventory.index')
            ->with('success', 'This stock-out was already saved.');
    }

    /**
     * Header field rules shared by store and update.
     *
     * @return array<string, array<int, mixed>>
     */
    private function headerRules(bool $deliveredToRequired): array
    {
        return [
            'patient_reference' => ['nullable', 'string', 'max:255'],
            'issued_by' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'delivered_to' => [$deliveredToRequired ? 'required' : 'nullable', 'string', 'max:255'],
            'delivered_to_tin' => ['nullable', 'string', 'max:50', 'regex:'.self::TIN_PATTERN],
            'delivered_to_address' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Per-line field rules shared by store and update. Branch ownership,
     * expiry and lot totals are added afterwards by addBasketErrors().
     *
     * @return array<string, array<int, mixed>>
     */
    private function itemRules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*' => ['required', 'array'],
            'items.*.pd_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.products_qty_id' => ['required', 'integer', 'exists:products_qty,id'],
            'items.*.quantity_deducted' => ['required', 'integer', 'min:1', 'max:'.self::MAX_QUANTITY],
            'items.*.unit_type' => ['required', 'string', Rule::in(UnitType::values())],
            // normaliseInput() nulls this on Piece lines, so it is only
            // ever checked on Box lines.
            'items.*.pieces_per_box' => ['nullable', 'required_if:items.*.unit_type,'.UnitType::Box->value, 'integer', 'min:1', 'max:'.self::MAX_QUANTITY],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function validationMessages(): array
    {
        $max = number_format(self::MAX_QUANTITY);
        $subtype = 'Choose a transaction type: Delivery to Customer or Returned to supplier.';
        $branch = 'The selected source branch does not exist or has been removed.';
        $basket = 'Add at least one medicine to the basket.';
        $medicine = 'Line :position: the selected medicine does not exist.';
        $lot = 'Line :position: the selected lot does not exist.';
        $unit = 'Line :position: choose Piece or Box.';
        $piecesPerBox = "Line :position: pieces per box must be a whole number from 1 to {$max}.";

        return [
            'transaction_subtype.required' => $subtype,
            'transaction_subtype.string' => $subtype,
            'transaction_subtype.in' => $subtype,
            'branch_id.required' => 'Choose the source branch.',
            'branch_id.integer' => $branch,
            'branch_id.exists' => $branch,
            'issued_by.required' => 'Enter who issued this stock-out.',
            'issued_by.max' => 'Issued by may not be longer than 255 characters.',
            'delivered_to.required' => 'Enter who the delivery is for. It is printed on the Delivery Receipt.',
            'delivered_to.max' => 'Delivered to may not be longer than 255 characters.',
            'delivered_to_address.max' => 'The delivery address may not be longer than 500 characters.',
            'delivered_to_tin.max' => 'The TIN may not be longer than 50 characters.',
            'delivered_to_tin.regex' => 'Enter the TIN as 9 digits with an optional 3-5 digit branch code, e.g. 123-456-789 or 123-456-789-00000.',
            'patient_reference.max' => 'Patient reference may not be longer than 255 characters.',
            'remarks.max' => 'Remarks may not be longer than 2000 characters.',
            'items.required' => $basket,
            'items.array' => $basket,
            'items.min' => $basket,
            'items.*.required' => 'Line :position: is not a valid basket line.',
            'items.*.array' => 'Line :position: is not a valid basket line.',
            'items.*.pd_id.required' => 'Line :position: choose a medicine.',
            'items.*.pd_id.integer' => $medicine,
            'items.*.pd_id.exists' => $medicine,
            'items.*.products_qty_id.required' => 'Line :position: choose a lot.',
            'items.*.products_qty_id.integer' => $lot,
            'items.*.products_qty_id.exists' => $lot,
            'items.*.quantity_deducted.required' => 'Line :position: enter a quantity.',
            'items.*.quantity_deducted.integer' => 'Line :position: quantity must be a whole number.',
            'items.*.quantity_deducted.min' => 'Line :position: quantity must be at least 1.',
            'items.*.quantity_deducted.max' => "Line :position: quantity may not be more than {$max}.",
            'items.*.unit_type.required' => $unit,
            'items.*.unit_type.string' => $unit,
            'items.*.unit_type.in' => $unit,
            'items.*.pieces_per_box.required_if' => 'Line :position: enter how many pieces are in one box.',
            'items.*.pieces_per_box.integer' => $piecesPerBox,
            'items.*.pieces_per_box.min' => $piecesPerBox,
            'items.*.pieces_per_box.max' => $piecesPerBox,
        ];
    }

    /**
     * Canonicalise unit types (legacy rows used lowercase) and drop
     * pieces_per_box from anything that is not a Box line.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function normaliseInput(array $input): array
    {
        if (! isset($input['items']) || ! is_array($input['items'])) {
            return $input;
        }

        foreach ($input['items'] as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $unitType = is_string($item['unit_type'] ?? null)
                ? UnitType::tryFromInput($item['unit_type'])
                : null;

            if ($unitType) {
                $item['unit_type'] = $unitType->value;
            }

            if ($unitType !== UnitType::Box) {
                $item['pieces_per_box'] = null;
            }

            $input['items'][$index] = $item;
        }

        return $input;
    }

    /**
     * Adds branch-ownership, expiry and lot-sufficiency errors for every
     * line whose own fields already passed, so one round trip reports all
     * problems.
     */
    private function addBasketErrors(\Illuminate\Validation\Validator $validator, mixed $items, int $branchId): void
    {
        if (! is_array($items)) {
            return;
        }

        $errors = $validator->errors();

        $checkable = array_filter($items, function ($item, $index) use ($errors) {
            if (! is_array($item)) {
                return false;
            }

            foreach (['', '.pd_id', '.products_qty_id', '.quantity_deducted', '.unit_type', '.pieces_per_box'] as $field) {
                if ($errors->has("items.{$index}{$field}")) {
                    return false;
                }
            }

            return true;
        }, ARRAY_FILTER_USE_BOTH);

        if ($checkable === []) {
            return;
        }

        [$basketErrors] = $this->resolveBasket($checkable, $branchId);

        foreach ($basketErrors as $key => $message) {
            $errors->add($key, $message);
        }
    }

    /**
     * Resolves each basket line to its medicine, lot and pieces, and checks
     * branch ownership, lot status/expiry and that the pieces taken from
     * each lot (summed over every line using it) fit the lot.
     *
     * @param  array<int|string, array<string, mixed>>  $items  already field-validated lines, keyed by basket index
     * @return array{0: array<string, string>, 1: list<array{medicine: MedicineProduct, batch: ProductQty, unit_type: UnitType, quantity: int, pieces_per_box: ?int, pieces: int}>}
     */
    private function resolveBasket(array $items, int $branchId, bool $lockLots = false): array
    {
        $errors = $this->itemBranchErrors($items, $branchId, checkBatches: true, lineNumbers: true);

        $medicines = MedicineProduct::query()
            ->whereKey(collect($items)->pluck('pd_id')->map(fn ($id) => (int) $id)->unique()->all())
            ->get()
            ->keyBy('id');

        $batches = ProductQty::query()
            ->whereKey(collect($items)->pluck('products_qty_id')->map(fn ($id) => (int) $id)->unique()->all())
            ->when($lockLots, fn ($query) => $query->lockForUpdate())
            ->get()
            ->keyBy('id');

        $piecesPerLot = [];
        $linesPerLot = [];
        $reportedLots = [];
        $lines = [];

        foreach ($items as $index => $item) {
            if (isset($errors["items.{$index}.pd_id"]) || isset($errors["items.{$index}.products_qty_id"])) {
                continue;
            }

            $medicine = $medicines->get((int) $item['pd_id']);
            $batch = $batches->get((int) $item['products_qty_id']);
            $lineNumber = (int) $index + 1;

            // The locked read may differ from the unlocked ownership check.
            if (! $medicine || ! $batch || (int) $batch->product_id !== (int) $medicine->id || $batch->isDeleted()) {
                $errors["items.{$index}.products_qty_id"] = "Line {$lineNumber}: the selected lot is no longer available.";

                continue;
            }

            if ($batch->status === ProductQty::STATUS_EXPIRED || $batch->isExpired()) {
                $expiry = $batch->expiry?->format('d M Y') ?? 'an earlier date';
                $errors["items.{$index}.products_qty_id"] = "Line {$lineNumber}: lot {$batch->lot_number} of {$medicine->med_name} expired on {$expiry} and cannot be dispensed.";

                continue;
            }

            $unitType = UnitType::fromInput($item['unit_type']);
            $quantity = (int) $item['quantity_deducted'];

            // Pieces-per-box comes from what the operator typed for THIS
            // stock-out, not the product's stored pack size — a shipment's
            // actual box count doesn't always match the master data.
            $piecesPerBox = $unitType->isBox() ? (int) $item['pieces_per_box'] : null;
            $pieces = $unitType->isBox() ? $quantity * $piecesPerBox : $quantity;

            $piecesPerLot[$batch->id] = ($piecesPerLot[$batch->id] ?? 0) + $pieces;
            $linesPerLot[$batch->id][] = $lineNumber;
            $available = (int) $batch->quantity;

            if ($piecesPerLot[$batch->id] > $available && ! isset($reportedLots[$batch->id])) {
                $reportedLots[$batch->id] = true;
                $errors["items.{$index}.quantity_deducted"] = count($linesPerLot[$batch->id]) === 1
                    ? "Line {$lineNumber}: {$pieces} pieces of {$medicine->med_name} exceed the {$available} pieces available in lot {$batch->lot_number}."
                    : "Line {$lineNumber}: lines ".$this->joinLineNumbers($linesPerLot[$batch->id])
                        ." together take {$piecesPerLot[$batch->id]} pieces of {$medicine->med_name} from lot {$batch->lot_number}, but only {$available} pieces are available.";
            }

            $lines[] = [
                'medicine' => $medicine,
                'batch' => $batch,
                'unit_type' => $unitType,
                'quantity' => $quantity,
                'pieces_per_box' => $piecesPerBox,
                'pieces' => $pieces,
            ];
        }

        return [$errors, $lines];
    }

    /**
     * @param  list<int>  $lineNumbers
     */
    private function joinLineNumbers(array $lineNumbers): string
    {
        $last = array_pop($lineNumbers);

        return $lineNumbers === [] ? (string) $last : implode(', ', $lineNumbers)." and {$last}";
    }

    /**
     * @param  array{medicine: MedicineProduct, batch: ProductQty, unit_type: UnitType, quantity: int, pieces_per_box: ?int, pieces: int}  $line
     */
    private function createItem(StockOut $stockOut, array $line): void
    {
        StockOutItem::create([
            'stock_out_id' => $stockOut->stock_out_id,
            'pd_id' => $line['medicine']->id,
            'products_qty_id' => $line['batch']->id,
            'lot_number' => $line['batch']->lot_number,
            'quantity_deducted' => $line['quantity'],
            'pieces_deducted' => $line['pieces'],
            'expiry' => $line['batch']->expiry,
            'unit_type' => $line['unit_type']->value,
            'pieces_per_box' => $line['pieces_per_box'],
            'unit_price' => $line['unit_type']->isBox()
                ? $line['medicine']->wholesale_price
                : $line['medicine']->retail_price,
        ]);
    }

    /**
     * Locks the lot and confirms it still belongs to this medicine in the
     * stock-out's branch and is fit to dispense right now.
     */
    private function assertBatchDispensableForBranch(int $batchId, MedicineProduct $medicine, int $branchId): void
    {
        $batch = ProductQty::query()
            ->whereKey($batchId)
            ->where('product_id', $medicine->id)
            ->whereHas('product', fn ($query) => $query->forBranch($branchId))
            ->lockForUpdate()
            ->first();

        if (! $batch || $batch->isDeleted()) {
            throw new \RuntimeException(
                "The selected lot is no longer available for {$medicine->med_name}. Edit the delivery and pick another lot."
            );
        }

        if ($batch->status === ProductQty::STATUS_EXPIRED || $batch->isExpired()) {
            $expiry = $batch->expiry?->format('d M Y') ?? 'an earlier date';

            throw new \RuntimeException(
                "Lot {$batch->lot_number} of {$medicine->med_name} expired on {$expiry} and cannot be dispensed. Edit the delivery and pick another lot."
            );
        }
    }

    private function isEditable(StockOut $stockOut): bool
    {
        return $stockOut->transaction_subtype === 'Delivery to Customer'
            && ! $stockOut->delivery_confirmed;
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
            'payment_method' => 'Delivery to Customer',
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
        return 'DISP-'.date('Ymd').'-'.str_pad((string) $stockOutId, 5, '0', STR_PAD_LEFT);
    }
}
