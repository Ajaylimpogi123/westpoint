<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\BranchCustomer;
use App\Models\MedicineProduct;
use App\Models\PosCart;
use App\Models\PosCartItem;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Services\InventoryStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
                    ->orWhere('phone_number', 'like', "%{$search}%");
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
            'phone_number' => ['required', 'digits:11'],
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
            'phone_number' => $validated['phone_number'],
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
            'items.*.unit_type' => ['required', 'string', 'in:Piece,Box'],
            'items.*.quantity_sold' => ['required', 'integer', 'min:1'],
            'payment_method' => ['required', 'string', 'in:cash,gcash'],
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

        try {
            DB::beginTransaction();

            $grossAmount = 0.0;
            $lineItems = [];

            foreach ($validated['items'] as $item) {
                $product = MedicineProduct::active()
                    ->forBranch($branchId)
                    ->findOrFail($item['product_id']);
                $unitType = $item['unit_type'];
                $quantitySold = (int) $item['quantity_sold'];

                $priceUsed = $unitType === 'Box'
                    ? (float) $product->wholesale_price
                    : (float) $product->retail_price;

                $lineTotal = round($priceUsed * $quantitySold, 2);
                $grossAmount += $lineTotal;

                $piecesNeeded = $unitType === 'Box'
                    ? $quantitySold * (int) $product->pack_size
                    : $quantitySold;

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
                    'unit_type' => $unitType,
                    'quantity_sold' => $quantitySold,
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
                'invoice_number' => $this->generateInvoiceNumber(),
                'branch_id' => $branchId,
                'user_id' => auth()->id(),
                'customer_name' => $customerName,
                'customer_id' => $customerId,
                'gross_amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'net_amount' => $netAmount,
                'payment_method' => $validated['payment_method'],
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

            return redirect()->route('pos.index')
                ->with('success', "Sale completed. Invoice {$sale->invoice_number}");
        } catch (\RuntimeException $e) {
            DB::rollBack();

            return redirect()->back()
                ->with('error', $e->getMessage());
        } catch (\Throwable $e) {
            DB::rollBack();

            return redirect()->back()
                ->with('error', 'Failed to process sale. Please try again.');
        }
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
                $batchQuery->available();
            }], 'quantity');

        if ($inStock) {
            $query->whereHas('batches', function ($batchQuery) {
                $batchQuery->available();
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

    private function getProductStock(int $productId): int
    {
        return (int) ProductQty::query()
            ->where('product_id', $productId)
            ->available()
            ->sum('quantity');
    }

    private function piecesForCartLine(MedicineProduct $product, string $unitType, int $quantitySold): int
    {
        return $unitType === 'Box'
            ? $quantitySold * (int) $product->pack_size
            : $quantitySold;
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
            throw new \RuntimeException("Insufficient Stock for {$productName}.");
        }

        $totalAvailable = (int) ProductQty::query()
            ->where('product_id', $productId)
            ->available()
            ->lockForUpdate()
            ->sum('quantity');

        if ($totalAvailable < $piecesNeeded) {
            throw new \RuntimeException("Insufficient Stock for {$productName}.");
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
        $batches = ProductQty::query()
            ->where('product_id', $productId)
            ->available()
            ->orderByRaw('CASE WHEN expiry IS NULL THEN 1 ELSE 0 END')
            ->orderBy('expiry')
            ->get();

        $allocations = [];
        $remaining = $piecesNeeded;

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $alreadyAllocated = $allocatedByBatch[$batch->id] ?? 0;
            $available = max((int) $batch->quantity - $alreadyAllocated, 0);

            if ($available <= 0) {
                continue;
            }

            $take = min($available, $remaining);
            $allocatedByBatch[$batch->id] = $alreadyAllocated + $take;

            $allocations[] = [
                'batch_id' => $batch->id,
                'lot_number' => $batch->lot_number,
                'expiry' => $batch->expiry?->format('Y-m-d'),
                'shelf_number' => $batch->shelf_number,
                'pieces' => $take,
            ];

            $remaining -= $take;
        }

        return $allocations;
    }

    private function deductStockFefo(int $productId, int $branchId, int $piecesNeeded, string $productName): array
    {
        $belongsToBranch = MedicineProduct::query()
            ->where('id', $productId)
            ->forBranch($branchId)
            ->exists();

        if (! $belongsToBranch) {
            throw new \RuntimeException("Insufficient Stock for {$productName}.");
        }

        $batches = ProductQty::query()
            ->where('product_id', $productId)
            ->available()
            ->orderByRaw('CASE WHEN expiry IS NULL THEN 1 ELSE 0 END')
            ->orderBy('expiry')
            ->lockForUpdate()
            ->get();

        $totalAvailable = (int) $batches->sum('quantity');

        if ($totalAvailable < $piecesNeeded) {
            throw new \RuntimeException("Insufficient Stock for {$productName}.");
        }

        $deductions = [];
        $remaining = $piecesNeeded;

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }

            $deduct = min((int) $batch->quantity, $remaining);
            $batch->update(['quantity' => (int) $batch->quantity - $deduct]);
            InventoryStockService::afterBatchQuantityChange($batch->fresh());

            $deductions[] = [
                'batch_id' => $batch->id,
                'pieces' => $deduct,
            ];

            $remaining -= $deduct;
        }

        return $deductions;
    }

    /**
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

        if (count($deductions) === 1) {
            SaleItem::create([
                'sale_id' => $saleId,
                'product_id' => $lineItem['product_id'],
                'products_qty_id' => $deductions[0]['batch_id'],
                'unit_type' => $lineItem['unit_type'],
                'quantity_sold' => $lineItem['quantity_sold'],
                'price_used' => $lineItem['price_used'],
                'total_price' => $lineItem['total_price'],
            ]);

            return;
        }

        $totalPieces = array_sum(array_column($deductions, 'pieces'));
        $allocatedTotal = 0.0;
        $lastIndex = count($deductions) - 1;

        foreach ($deductions as $index => $deduction) {
            $isLast = $index === $lastIndex;
            $portion = $isLast
                ? round($lineItem['total_price'] - $allocatedTotal, 2)
                : round(($deduction['pieces'] / $totalPieces) * $lineItem['total_price'], 2);

            $allocatedTotal += $portion;

            SaleItem::create([
                'sale_id' => $saleId,
                'product_id' => $lineItem['product_id'],
                'products_qty_id' => $deduction['batch_id'],
                'unit_type' => 'Piece',
                'quantity_sold' => $deduction['pieces'],
                'price_used' => round($portion / max($deduction['pieces'], 1), 2),
                'total_price' => $portion,
            ]);
        }
    }

    private function generateInvoiceNumber(): string
    {
        return 'POS-' . date('Ymd') . '-' . str_pad((string) mt_rand(1, 99999), 5, '0', STR_PAD_LEFT);
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
     *     phone_number: ?string,
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
            'phone_number' => $customer->phone_number,
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
