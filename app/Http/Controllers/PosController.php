<?php

namespace App\Http\Controllers;

use App\Enums\UnitType;
use App\Exceptions\InsufficientStockException;
use App\Models\Branch;
use App\Models\BranchCustomer;
use App\Models\MedicineProduct;
use App\Models\PosCart;
use App\Models\PosCartItem;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SaleItemAllocation;
use App\Services\DocumentNumberService;
use App\Services\IdempotencyGuard;
use App\Services\InventoryStockService;
use App\Services\ReceiptPrinterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function index(): Response
    {
        $branchId = $this->branchIdOrFail();
        $roleId = $this->roleId();
        $canFilterBranches = $roleId === 2;
        $branchName = Branch::query()
            ->whereKey($branchId)
            ->value('branch_name');

        return Inertia::render('Pos/Index', [
            'branchId' => $branchId,
            'branchName' => $branchName,
            'branches' => $canFilterBranches
                ? Branch::orderBy('branch_name')->get(['id', 'branch_name'])
                : [],
            'activeCart' => $this->serializeActiveCart($branchId),
        ]);
    }

    public function searchProducts(Request $request): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'search'       => ['nullable', 'string', 'max:255'],
            'page'         => ['sometimes', 'integer', 'min:1'],
            'form'         => ['nullable', 'string', 'max:100'],
            'best_seller'  => ['sometimes', 'boolean'],
            'in_stock'     => ['sometimes', 'boolean'],
            'generic_only' => ['sometimes', 'boolean'],
        ]);

        $search      = trim($validated['search'] ?? '');
        $form        = trim($validated['form'] ?? '');
        $bestSeller  = $request->boolean('best_seller', false);
        $inStock     = $request->boolean('in_stock', true);
        $genericOnly = $request->boolean('generic_only', false);

        $products = $this->branchProductsQuery($branchId, $inStock, $bestSeller)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('med_name', 'like', "%{$search}%")
                        ->orWhere('brand_name', 'like', "%{$search}%");
                });
            })
            ->when($form !== '', function ($query) use ($form) {
                $query->where('tbl_products.form', $form);
            })
            ->when($genericOnly, function ($query) {
                $query->where('tbl_products.is_generic', true);
            })
            ->paginate(50);

        return response()->json($products);
    }

    public function searchCustomers(Request $request): JsonResponse
    {
        $this->branchIdOrFail();

        $validated = $request->validate([
            'search' => ['required', 'string', 'min:1', 'max:255'],
        ]);

        $search = trim($validated['search']);
        $roleId = $this->roleId();
        $canFilterBranches = $roleId === 2;

        $customers = BranchCustomer::query()
            ->with('branch:id,branch_name')
            ->where('status', 'active')
            ->when(! $canFilterBranches, fn ($query) => $query->forBranch($this->branchIdOrFail()))
            ->where(function ($query) use ($search) {
                $query->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('senior_id_number', 'like', "%{$search}%")
                    ->orWhere('pwd_id_number', 'like', "%{$search}%");
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(20)
            ->get()
            ->map(fn (BranchCustomer $customer) => $this->serializeCustomer($customer));

        return response()->json(['customers' => $customers]);
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $roleId = $this->roleId();
        $canAssignBranch = $roleId === 2;

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'senior_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,Senior Citizen'],
            'pwd_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,PWD'],
            'customer_type' => ['required', 'string', 'in:Regular,Senior Citizen,PWD'],
            'branch_id' => [$canAssignBranch ? 'required' : 'nullable', 'integer', 'exists:branches,id'],
        ]);

        $branchId = $canAssignBranch
            ? (int) $validated['branch_id']
            : $this->branchIdOrFail();

        $customer = BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'senior_id_number' => $validated['customer_type'] === 'Senior Citizen'
                ? ($validated['senior_id_number'] ?? null)
                : null,
            'pwd_id_number' => $validated['customer_type'] === 'PWD'
                ? ($validated['pwd_id_number'] ?? null)
                : null,
            'customer_type' => $validated['customer_type'],
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        $customer->load('branch:id,branch_name');

        return response()->json([
            'customer' => $this->serializeCustomer($customer),
        ], 201);
    }

    public function storeCartItem(Request $request): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'unit_type' => ['required', 'string', 'in:Piece,Box'],
        ]);

        $product = MedicineProduct::active()
            ->forBranch($branchId)
            ->findOrFail($validated['product_id']);

        $cart = $this->getOrCreateActiveCart($branchId);

        $existing = PosCartItem::query()
            ->where('cart_id', $cart->id)
            ->where('product_id', $validated['product_id'])
            ->where('unit_type', $validated['unit_type'])
            ->first();

        $newQuantity = $existing
            ? (int) $existing->quantity_sold + 1
            : 1;

        $stockError = $this->cartStockValidationError(
            $product,
            $cart->id,
            $validated['unit_type'],
            $newQuantity,
            $existing?->id
        );

        if ($stockError) {
            return response()->json(['message' => $stockError], 422);
        }

        if ($existing) {
            $existing->increment('quantity_sold');
        } else {
            PosCartItem::create([
                'cart_id' => $cart->id,
                'product_id' => $validated['product_id'],
                'unit_type' => $validated['unit_type'],
                'quantity_sold' => 1,
            ]);
        }

        return response()->json($this->serializeActiveCart($branchId));
    }

    public function updateCart(Request $request): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'customer_id' => ['nullable', 'integer', 'exists:tbl_customers,customer_id'],
        ]);

        $cart = $this->getOrCreateActiveCart($branchId);
        $customerId = $validated['customer_id'] ?? null;

        if ($customerId) {
            $roleId = $this->roleId();
            $canFilterBranches = $roleId === 2;

            $customer = BranchCustomer::query()
                ->where('customer_id', $customerId)
                ->where('status', 'active')
                ->when(! $canFilterBranches, fn ($query) => $query->forBranch($branchId))
                ->first();

            if (! $customer) {
                return response()->json([
                    'message' => 'Selected customer was not found for your branch.',
                ], 422);
            }

            $cart->update([
                'customer_id' => $customer->customer_id,
                'customer_name' => trim("{$customer->first_name} {$customer->last_name}"),
            ]);
        } else {
            $cart->update([
                'customer_id' => null,
                'customer_name' => null,
            ]);
        }

        return response()->json($this->serializeActiveCart($branchId));
    }

    public function updateCartItem(Request $request, PosCartItem $cartItem): JsonResponse
    {
        $branchId = $this->branchIdOrFail();
        $this->assertCartItemAccess($cartItem, $branchId);
        $cartItem->loadMissing('product');

        $validated = $request->validate([
            'quantity_sold' => ['sometimes', 'integer', 'min:1'],
            'unit_type' => ['sometimes', 'string', 'in:Piece,Box'],
        ]);

        if (isset($validated['unit_type']) && $validated['unit_type'] !== $cartItem->unit_type) {
            $stockError = $this->changeCartItemUnitType($cartItem, $validated['unit_type']);

            if ($stockError) {
                return response()->json(['message' => $stockError], 422);
            }

            return response()->json($this->serializeActiveCart($branchId));
        }

        if (isset($validated['quantity_sold'])) {
            $stockError = $this->cartStockValidationError(
                $cartItem->product,
                $cartItem->cart_id,
                $cartItem->unit_type,
                (int) $validated['quantity_sold'],
                $cartItem->id
            );

            if ($stockError) {
                return response()->json(['message' => $stockError], 422);
            }

            $cartItem->update(['quantity_sold' => $validated['quantity_sold']]);
        }

        return response()->json($this->serializeActiveCart($branchId));
    }

    public function destroyCartItem(PosCartItem $cartItem): JsonResponse
    {
        $branchId = $this->branchIdOrFail();
        $this->assertCartItemAccess($cartItem, $branchId);

        $cartItem->delete();

        return response()->json($this->serializeActiveCart($branchId));
    }

    public function previewCheckout(): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        $cart = $this->activeCartQuery($branchId)
            ->with(['items.product'])
            ->first();

        if (! $cart || $cart->items->isEmpty()) {
            return response()->json(['items' => []]);
        }

        $allocatedByBatch = [];
        $items = [];

        foreach ($cart->items as $item) {
            $product = $item->product;
            $unitType = $item->unit_type;
            $quantity = (int) $item->quantity_sold;
            $piecesNeeded = $this->piecesForCartLine($product, $unitType, $quantity);

            $priceUsed = $unitType === 'Box'
                ? (float) $product->wholesale_price
                : (float) $product->retail_price;

            $items[] = [
                'cart_item_id' => $item->id,
                'product' => [
                    'id' => $product->id,
                    'med_name' => $product->med_name,
                    'brand_name' => $product->brand_name,
                    'dose' => $product->dose,
                    'form' => $product->form,
                    'pack_size' => (int) $product->pack_size,
                    'is_generic' => (bool) $product->is_generic,
                ],
                'unitType' => $unitType,
                'quantity' => $quantity,
                'pieces' => $piecesNeeded,
                'priceUsed' => $priceUsed,
                'totalPrice' => round($priceUsed * $quantity, 2),
                'batches' => $this->previewStockFefo(
                    $product->id,
                    $piecesNeeded,
                    $allocatedByBatch
                ),
            ];
        }

        return response()->json(['items' => $items]);
    }

    public function store(Request $request): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'cart_id' => ['required', 'integer', 'exists:tbl_carts,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.unit_type' => ['required', 'string', Rule::in(UnitType::values())],
            'items.*.quantity_sold' => [
                'required',
                'integer',
                'min:1',
                'max:' . InventoryStockService::MAX_TRANSACTION_QUANTITY,
            ],
            'payment_method' => ['required', 'string', 'in:cash,gcash,debit_card,credit_card'],
            'reference_number' => ['nullable', 'string', 'max:255'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'amount_received' => ['required', 'numeric', 'min:0'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer', 'exists:tbl_customers,customer_id'],
        ]);

        $cart = PosCart::query()
            ->where('id', $validated['cart_id'])
            ->where('branch_id', $branchId)
            ->where('user_id', auth()->id())
            ->first();

        if (! $cart) {
            return redirect()->back()
                ->with('error', 'Active cart not found for your branch session.');
        }

        $discountAmount = (float) ($validated['discount_amount'] ?? 0);
        $customerName = isset($validated['customer_name'])
            ? trim($validated['customer_name'])
            : null;
        $customerId = isset($validated['customer_id'])
            ? (int) $validated['customer_id']
            : null;

        if ($customerName === '') {
            $customerName = null;
        }

        if ($customerId) {
            $customer = BranchCustomer::query()
                ->where('customer_id', $customerId)
                ->where('status', 'active')
                ->first();

            if (! $customer) {
                return redirect()->back()
                    ->with('error', 'Selected customer was not found.');
            }

            $customerName = trim("{$customer->first_name} {$customer->last_name}");
        }

        $idempotencyKey = $request->input('idempotency_key');

        if (! IdempotencyGuard::claim(IdempotencyGuard::SCOPE_POS_CHECKOUT, $idempotencyKey)) {
            return redirect()->route('pos.index')
                ->with('success', 'This sale was already completed.');
        }

        try {
            DB::beginTransaction();

            $grossAmount = 0.0;
            $lineItems = [];

            foreach ($validated['items'] as $item) {
                $product = MedicineProduct::active()
                    ->forBranch($branchId)
                    ->findOrFail($item['product_id']);
                $unitType = UnitType::fromInput($item['unit_type']);
                $quantitySold = (int) $item['quantity_sold'];

                $priceUsed = $unitType->isBox()
                    ? (float) $product->wholesale_price
                    : (float) $product->retail_price;

                $lineTotal = round($priceUsed * $quantitySold, 2);
                $grossAmount += $lineTotal;

                $piecesNeeded = $product->toPieces($quantitySold, $unitType);

                $this->assertSufficientBranchStock(
                    $product->id,
                    $branchId,
                    $piecesNeeded,
                    $product->med_name
                );

                $deductions = $this->deductStockFefo(
                    $product->id,
                    $branchId,
                    $piecesNeeded,
                    $product->med_name
                );

                $lineItems[] = [
                    'product_id' => $product->id,
                    'unit_type' => $unitType->value,
                    'quantity_sold' => $quantitySold,
                    'pieces_sold' => $piecesNeeded,
                    'price_used' => $priceUsed,
                    'total_price' => $lineTotal,
                    'deductions' => $deductions,
                ];
            }

            $netAmount = max(round($grossAmount - $discountAmount, 2), 0);

            if ($validated['payment_method'] === 'cash' && (float) $validated['amount_received'] < $netAmount) {
                throw new \RuntimeException('Amount received is less than the net total.');
            }

            $sale = Sale::create([
                'invoice_number' => $this->generateInvoiceNumber($branchId),
                'branch_id' => $branchId,
                'user_id' => auth()->id(),
                'customer_name' => $customerName,
                'customer_id' => $customerId,
                'gross_amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'net_amount' => $netAmount,
                'payment_method' => $validated['payment_method'],
                'reference_number' => isset($validated['reference_number'])
                    ? trim($validated['reference_number']) ?: null
                    : null,
            ]);

            foreach ($lineItems as $lineItem) {
                $this->createSaleItemRows($sale->id, $lineItem);
            }

            PosCart::query()
                ->where('id', $cart->id)
                ->where('branch_id', $branchId)
                ->where('user_id', auth()->id())
                ->delete();

            DB::commit();
        } catch (\RuntimeException $e) {
            DB::rollBack();
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_POS_CHECKOUT, $idempotencyKey);

            return redirect()->back()
                ->with('error', $e->getMessage());
        } catch (\Throwable $e) {
            DB::rollBack();
            report($e);
            IdempotencyGuard::release(IdempotencyGuard::SCOPE_POS_CHECKOUT, $idempotencyKey);

            return redirect()->back()
                ->with('error', 'Failed to process sale. Please try again.');
        }

        // Printing happens after the transaction and outside its error
        // boundary. It used to sit inside the try, so a printer fault routed
        // to the catch and told the cashier the sale had failed — while it
        // was already committed — prompting them to ring it up twice.
        $printed = $this->printReceiptSafely($sale);

        return redirect()->route('pos.index')
            ->with([
                'success' => $printed
                    ? "Sale completed. Invoice {$sale->invoice_number}"
                    : "Sale completed. Invoice {$sale->invoice_number} — the receipt did not print; use Reprint.",
                'sale_id' => $sale->id,
                'receipt_printed' => $printed,
            ]);
    }

    private function printReceiptSafely(Sale $sale): bool
    {
        try {
            $sale->load('items.product');
            app(ReceiptPrinterService::class)->printReceipt($sale);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    public function printInvoice(Sale $sale): Response
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $sale->branch_id !== $branchId) {
            abort(403, 'Sale is not accessible in your branch session.');
        }

        $sale->load([
            'items' => function ($query) {
                $query->select([
                    'id',
                    'sale_id',
                    'product_id',
                    'unit_type',
                    'quantity_sold',
                    'price_used',
                    'total_price',
                ]);
            },
            'items.product:id,med_name,dose,form,brand_name',
            'user:id,name',
        ]);

        return Inertia::render('Pos/InvoiceReceipt', [
            'sale' => $sale,
        ]);
    }

    private function getOrCreateActiveCart(int $branchId): PosCart
    {
        return PosCart::query()->firstOrCreate(
            [
                'branch_id' => $branchId,
                'user_id' => auth()->id(),
            ]
        );
    }

    private function activeCartQuery(int $branchId)
    {
        return PosCart::query()
            ->where('branch_id', $branchId)
            ->where('user_id', auth()->id());
    }

    private function assertCartItemAccess(PosCartItem $cartItem, int $branchId): void
    {
        $cartItem->loadMissing('cart');

        if (
            ! $cartItem->cart
            || (int) $cartItem->cart->branch_id !== $branchId
            || (int) $cartItem->cart->user_id !== (int) auth()->id()
        ) {
            abort(403, 'Cart item is not accessible in your branch session.');
        }
    }

    private function changeCartItemUnitType(PosCartItem $cartItem, string $unitType): ?string
    {
        $cartItem->loadMissing('product');

        $existing = PosCartItem::query()
            ->where('cart_id', $cartItem->cart_id)
            ->where('product_id', $cartItem->product_id)
            ->where('unit_type', $unitType)
            ->where('id', '!=', $cartItem->id)
            ->first();

        if ($existing) {
            $mergedQuantity = (int) $existing->quantity_sold + (int) $cartItem->quantity_sold;

            $stockError = $this->cartStockValidationError(
                $cartItem->product,
                $cartItem->cart_id,
                $unitType,
                $mergedQuantity,
                $existing->id
            );

            if ($stockError) {
                return $stockError;
            }

            $existing->update([
                'quantity_sold' => $mergedQuantity,
            ]);
            $cartItem->delete();

            return null;
        }

        $stockError = $this->cartStockValidationError(
            $cartItem->product,
            $cartItem->cart_id,
            $unitType,
            (int) $cartItem->quantity_sold,
            $cartItem->id
        );

        if ($stockError) {
            return $stockError;
        }

        $cartItem->update(['unit_type' => $unitType]);

        return null;
    }

    /**
     * @return array{
     *     id: int|null,
     *     customer: array<string, mixed>|null,
     *     items: array<int, array<string, mixed>>
     * }
     */
    private function serializeActiveCart(int $branchId): array
    {
        $cart = $this->activeCartQuery($branchId)
            ->with(['items.product', 'customer.branch'])
            ->first();

        if (! $cart) {
            return [
                'id' => null,
                'customer' => null,
                'items' => [],
            ];
        }

        return [
            'id' => $cart->id,
            'customer' => $cart->customer
                ? $this->serializeCustomer($cart->customer)
                : null,
            'items' => $cart->items->map(function (PosCartItem $item) {
                $product = $item->product;
                $unitType = $item->unit_type;
                $quantity = (int) $item->quantity_sold;
                $totalStock = $this->getProductStock($product->id);

                $priceUsed = $unitType === 'Box'
                    ? (float) $product->wholesale_price
                    : (float) $product->retail_price;

                return [
                    'id' => $item->id,
                    'key' => "{$item->product_id}-{$unitType}",
                    'product' => array_merge($product->toArray(), [
                        'total_stock' => $totalStock,
                    ]),
                    'unitType' => $unitType,
                    'quantity' => $quantity,
                    'priceUsed' => $priceUsed,
                    'totalPrice' => round($priceUsed * $quantity, 2),
                ];
            })->values()->all(),
        ];
    }

    private function branchProductsQuery(int $branchId, bool $inStock = true, bool $bestSeller = false)
    {
        $query = MedicineProduct::query()
            ->active()
            ->forBranch($branchId)
            ->withSum(['batches as total_stock' => function ($batchQuery) {
                $batchQuery->dispensable();
            }], 'quantity');

        if ($inStock) {
            $query->whereHas('batches', function ($batchQuery) {
                $batchQuery->dispensable();
            });
        }

        if ($bestSeller) {
            $query->orderByRaw(
                '(SELECT COALESCE(SUM(si.quantity_sold), 0) FROM tbl_sales_items si WHERE si.product_id = tbl_products.id) DESC'
            );
        } else {
            $query->orderBy('med_name');
        }

        return $query;
    }

    /**
     * Pieces this product can actually be sold in. Expired batches are
     * excluded: FEFO sorts by earliest expiry, so including them meant the
     * most-expired stock was preferentially dispensed.
     */
    private function getProductStock(int $productId): int
    {
        return InventoryStockService::dispensableStock($productId);
    }

    private function piecesForCartLine(MedicineProduct $product, string $unitType, int $quantitySold): int
    {
        return $product->toPieces($quantitySold, $unitType);
    }

    /**
     * @param  array<int>  $excludeItemIds
     */
    private function piecesInCartForProduct(
        int $cartId,
        int $productId,
        array $excludeItemIds = []
    ): int {
        $items = PosCartItem::query()
            ->where('cart_id', $cartId)
            ->where('product_id', $productId)
            ->when($excludeItemIds !== [], function ($query) use ($excludeItemIds) {
                $query->whereNotIn('id', $excludeItemIds);
            })
            ->with('product')
            ->get();

        return (int) $items->sum(function (PosCartItem $item) {
            return $this->piecesForCartLine(
                $item->product,
                $item->unit_type,
                (int) $item->quantity_sold
            );
        });
    }

    private function cartStockValidationError(
        MedicineProduct $product,
        int $cartId,
        string $unitType,
        int $newQuantity,
        ?int $excludeItemId = null
    ): ?string {
        $excludeItemIds = $excludeItemId ? [$excludeItemId] : [];
        $available = $this->getProductStock($product->id);
        $otherPieces = $this->piecesInCartForProduct($cartId, $product->id, $excludeItemIds);
        $newPieces = $this->piecesForCartLine($product, $unitType, $newQuantity);

        if ($otherPieces + $newPieces > $available) {
            return "Insufficient Stock for {$product->med_name}.";
        }

        return null;
    }

    private function assertSufficientBranchStock(
        int $productId,
        int $branchId,
        int $piecesNeeded,
        string $productName
    ): void {
        $belongsToBranch = MedicineProduct::query()
            ->where('id', $productId)
            ->forBranch($branchId)
            ->exists();

        if (! $belongsToBranch) {
            throw InsufficientStockException::forProduct($productName);
        }

        if (InventoryStockService::dispensableStock($productId, lock: true) < $piecesNeeded) {
            throw InsufficientStockException::forProduct($productName);
        }
    }

    /**
     * @return array<int, array{batch_id: int, pieces: int}>
     */
    /**
     * @param  array<int, int>  $allocatedByBatch
     * @return array<int, array{batch_id: int, lot_number: ?string, expiry: ?string, shelf_number: ?string, pieces: int}>
     */
    private function previewStockFefo(int $productId, int $piecesNeeded, array &$allocatedByBatch): array
    {
        return InventoryStockService::previewFefo($productId, $piecesNeeded, $allocatedByBatch);
    }

    private function deductStockFefo(int $productId, int $branchId, int $piecesNeeded, string $productName): array
    {
        $belongsToBranch = MedicineProduct::query()
            ->where('id', $productId)
            ->forBranch($branchId)
            ->exists();

        if (! $belongsToBranch) {
            throw InsufficientStockException::forProduct($productName);
        }

        return InventoryStockService::deductFefo($productId, $piecesNeeded, $productName);
    }

    /**
     * Persist one commercial sale line, then record batch allocations when FEFO
     * pulled from more than one lot. Split-batch lines used to be rewritten as
     * multiple Piece rows, which broke receipts and unit-based reporting.
     *
     * @param  array{
     *     product_id: int,
     *     unit_type: string,
     *     quantity_sold: int,
     *     price_used: float,
     *     total_price: float,
     *     deductions: array<int, array{batch_id: int, pieces: int}>
     * }  $lineItem
     */
    private function createSaleItemRows(int $saleId, array $lineItem): void
    {
        $deductions = $lineItem['deductions'];

        $saleItem = SaleItem::create([
            'sale_id' => $saleId,
            'product_id' => $lineItem['product_id'],
            'products_qty_id' => $deductions[0]['batch_id'] ?? null,
            'unit_type' => $lineItem['unit_type'],
            'quantity_sold' => $lineItem['quantity_sold'],
            'price_used' => $lineItem['price_used'],
            'total_price' => $lineItem['total_price'],
        ]);

        if (count($deductions) <= 1) {
            return;
        }

        foreach ($deductions as $deduction) {
            SaleItemAllocation::create([
                'sale_item_id' => $saleItem->id,
                'products_qty_id' => $deduction['batch_id'],
                'pieces' => $deduction['pieces'],
            ]);
        }
    }

    /**
     * Allocated from a per-branch, per-day counter inside the sale's
     * transaction. Random numbers in a 99,999 space collided against the
     * unique index often enough to abort real sales, and gave an unordered
     * series that an audit cannot follow.
     */
    private function generateInvoiceNumber(int $branchId): string
    {
        return DocumentNumberService::posInvoiceNumber($branchId);
    }

    private function branchId(): ?int
    {
        $branchId = session('branch_id');

        return $branchId ? (int) $branchId : null;
    }

    private function roleId(): int
    {
        return (int) session('role_id');
    }

    /**
     * @return array{
     *     customer_id: int,
     *     first_name: string,
     *     last_name: string,
     *     senior_id_number: ?string,
     *     pwd_id_number: ?string,
     *     customer_type: string,
     *     branch_name: ?string
     * }
     */
    private function serializeCustomer(BranchCustomer $customer): array
    {
        return [
            'customer_id' => $customer->customer_id,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'senior_id_number' => $customer->senior_id_number,
            'pwd_id_number' => $customer->pwd_id_number,
            'customer_type' => $customer->customer_type,
            'branch_name' => $customer->branch?->branch_name,
        ];
    }

    private function branchIdOrFail(): int
    {
        $branchId = $this->branchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }
}
