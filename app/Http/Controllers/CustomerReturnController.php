<?php

namespace App\Http\Controllers;

use App\Enums\UnitType;
use App\Exceptions\InvalidPackSizeException;
use App\Models\BranchCustomer;
use App\Models\CustomerReturn;
use App\Models\CustomerReturnItem;
use App\Models\MedicineProduct;
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

class CustomerReturnController extends Controller
{
    private const MAX_QUANTITY = InventoryStockService::MAX_TRANSACTION_QUANTITY;

    public function store(Request $request): RedirectResponse
    {
        $sessionBranchId = $this->branchIdOrFail();
        $canAssignBranch = $this->canAssignBranch();

        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:tbl_customers,customer_id'],
            'return_date' => ['required', 'date'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'received_by' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.pd_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.batch_number' => ['required', 'string', 'max:100'],
            'items.*.expiry_date' => ['required', 'date', 'after:today'],
            'items.*.quantity_received' => ['required', 'integer', 'min:1', 'max:' . self::MAX_QUANTITY],
            'items.*.shelf_number' => ['nullable', 'string', 'max:50'],
            'items.*.unit_type' => ['required', 'string', Rule::in(UnitType::values())],
            'items.*.confirm_duplicate_lot' => ['sometimes', 'boolean'],
        ], [
            'items.*.expiry_date.after' => 'The expiry date must be in the future. Expired returns cannot be received back into stock.',
        ]);

        $branchId = $canAssignBranch
            ? (int) $validated['branch_id']
            : $sessionBranchId;

        if (! $canAssignBranch && (int) $validated['branch_id'] !== $sessionBranchId) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'The destination branch does not match your session branch.');
        }

        // The customer must belong to the branch the return is being
        // recorded for, so a crafted payload can't attribute a return to
        // someone else's customer.
        $customerBelongsToBranch = BranchCustomer::query()
            ->whereKey($validated['customer_id'])
            ->where('branch_id', $branchId)
            ->exists();

        if (! $customerBelongsToBranch) {
            return redirect()->back()
                ->withInput()
                ->with('error', 'The selected customer does not belong to this branch.');
        }

        $idempotencyKey = $request->input('idempotency_key');

        if (! IdempotencyGuard::claim(IdempotencyGuard::SCOPE_CUSTOMER_RETURN, $idempotencyKey)) {
            return redirect()->route('medicine-inventory.index')
                ->with('success', 'This return was already saved.');
        }

        try {
            DB::transaction(function () use ($validated, $branchId) {
                $customerReturn = CustomerReturn::create([
                    'customer_id' => $validated['customer_id'],
                    'return_date' => $validated['return_date'],
                    'branch_id' => $branchId,
                    'received_by' => $validated['received_by'],
                    'remarks' => $validated['remarks'] ?? null,
                ]);

                foreach ($validated['items'] as $item) {
                    $medicine = MedicineProduct::query()
                        ->active()
                        ->forBranch($branchId)
                        ->findOrFail($item['pd_id']);

                    $unitType = UnitType::fromInput($item['unit_type']);
                    $quantity = (int) $item['quantity_received'];
                    $quantityInPieces = $medicine->toPieces($quantity, $unitType);

                    InventoryStockService::assertStockInIntentAllowed(
                        productId: $medicine->id,
                        branchId: $branchId,
                        lotNumber: $item['batch_number'],
                        expiry: $item['expiry_date'],
                        shelfNumber: $item['shelf_number'] ?? null,
                        confirmDuplicateLot: (bool) ($item['confirm_duplicate_lot'] ?? false),
                    );

                    CustomerReturnItem::create([
                        'return_id' => $customerReturn->return_id,
                        'pd_id' => $medicine->id,
                        'batch_number' => $item['batch_number'],
                        'expiry_date' => $item['expiry_date'],
                        'quantity_received' => $quantity,
                        'pieces_received' => $quantityInPieces,
                        'unit_type' => $unitType->value,
                        'unit_price' => $unitType->isBox()
                            ? $medicine->wholesale_price
                            : $medicine->retail_price,
                    ]);

                    InventoryStockService::addStock(
                        productId: $medicine->id,
                        branchId: $branchId,
                        quantityInPieces: $quantityInPieces,
                        lotNumber: $item['batch_number'],
                        expiry: $item['expiry_date'],
                        shelfNumber: $item['shelf_number'] ?? null,
                    );

                    InventoryMovementLogger::log(
                        branchId: $branchId,
                        movementType: InventoryMovementLog::TYPE_CUSTOMER_RETURN,
                        referenceLabel: "Customer Return #{$customerReturn->return_id}",
                        referenceId: $customerReturn->return_id,
                        pdId: $medicine->id,
                        medicineName: $medicine->med_name,
                        lotNumber: $item['batch_number'],
                        quantity: $quantityInPieces,
                        remarks: $validated['remarks'] ?? 'Customer return',
                    );
                }
            });
        } catch (InvalidPackSizeException | \RuntimeException $exception) {
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_CUSTOMER_RETURN, $idempotencyKey);

            return redirect()->back()
                ->withInput()
                ->with('error', $exception->getMessage());
        } catch (Throwable $exception) {
            report($exception);
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_CUSTOMER_RETURN, $idempotencyKey);

            return redirect()->back()
                ->withInput()
                ->with('error', 'Return could not be saved. Please verify your entries and try again.');
        }

        return redirect()->back()
            ->with('success', 'Customer return recorded successfully.');
    }

    public function show(CustomerReturn $customerReturn): JsonResponse
    {
        $this->assertCanAccessBranchTransaction((int) $customerReturn->branch_id);

        $customerReturn->load([
            'customer:customer_id,first_name,last_name,customer_type',
            'items' => function ($query) {
                $query->select([
                    'item_id',
                    'return_id',
                    'pd_id',
                    'batch_number',
                    'expiry_date',
                    'quantity_received',
                    'pieces_received',
                    'unit_type',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form',
        ]);

        return response()->json([
            'customer_return' => [
                'return_id' => $customerReturn->return_id,
                'customer' => $customerReturn->customer ? [
                    'name' => trim($customerReturn->customer->first_name . ' ' . $customerReturn->customer->last_name),
                    'customer_type' => $customerReturn->customer->customer_type,
                ] : null,
                'return_date' => $customerReturn->return_date,
                'received_by' => $customerReturn->received_by,
                'remarks' => $customerReturn->remarks,
                'created_at' => $customerReturn->created_at,
            ],
            'items' => $customerReturn->items->map(function (CustomerReturnItem $item) {
                return [
                    'item_id' => $item->item_id,
                    'batch_number' => $item->batch_number,
                    'expiry_date' => $item->expiry_date,
                    'quantity_received' => $item->quantity_received,
                    'pieces_received' => $item->pieces_received,
                    'unit_type' => $item->unit_type,
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

    public function receipt(CustomerReturn $customerReturn): Response
    {
        $this->assertCanAccessBranchTransaction((int) $customerReturn->branch_id);

        $customerReturn->load([
            'branch',
            'customer',
            'items' => function ($query) {
                $query->select([
                    'item_id', 'return_id', 'pd_id', 'batch_number', 'expiry_date',
                    'quantity_received', 'pieces_received', 'unit_type', 'unit_price',
                ]);
            },
            'items.product:id,med_name,brand_name,dose,form,pack_size,retail_price,wholesale_price',
        ]);

        return Inertia::render('MedicineInventory/CustomerReturnReceipt', [
            'customerReturn' => $customerReturn,
        ]);
    }

    private function assertCanAccessBranchTransaction(int $transactionBranchId): void
    {
        if ($this->canAssignBranch()) {
            return;
        }

        $branchId = $this->branchIdOrFail();

        if ($transactionBranchId !== $branchId) {
            abort(403, 'You do not have access to this return.');
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