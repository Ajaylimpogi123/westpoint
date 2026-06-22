<?php

namespace App\Http\Controllers;

use App\Models\MedicineProduct;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
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

        return Inertia::render('Pos/Index', [
            'products' => $this->branchProductsQuery($branchId)->get(),
            'branchId' => $branchId,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $branchId = $this->branchIdOrFail();

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:tbl_products,id'],
            'items.*.unit_type' => ['required', 'string', 'in:Piece,Box'],
            'items.*.quantity_sold' => ['required', 'integer', 'min:1'],
            'payment_method' => ['required', 'string', 'in:cash,gcash'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'amount_received' => ['required', 'numeric', 'min:0'],
        ]);

        $discountAmount = (float) ($validated['discount_amount'] ?? 0);

        try {
            DB::beginTransaction();

            $grossAmount = 0.0;
            $lineItems = [];

            foreach ($validated['items'] as $item) {
                $product = MedicineProduct::active()->findOrFail($item['product_id']);
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
                'gross_amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'net_amount' => $netAmount,
                'payment_method' => $validated['payment_method'],
            ]);

            foreach ($lineItems as $lineItem) {
                $this->createSaleItemRows($sale->id, $lineItem);
            }

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

    private function branchProductsQuery(int $branchId)
    {
        return MedicineProduct::query()
            ->active()
            ->withSum(['batches as total_stock' => function ($batchQuery) use ($branchId) {
                $batchQuery
                    ->where('branch_id', $branchId)
                    ->where('status', 'Active')
                    ->where('quantity', '>', 0);
            }], 'quantity')
            ->whereHas('batches', function ($batchQuery) use ($branchId) {
                $batchQuery
                    ->where('branch_id', $branchId)
                    ->where('status', 'Active')
                    ->where('quantity', '>', 0);
            })
            ->orderBy('med_name');
    }

    private function assertSufficientBranchStock(
        int $productId,
        int $branchId,
        int $piecesNeeded,
        string $productName
    ): void {
        $totalAvailable = (int) ProductQty::query()
            ->where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->where('status', 'Active')
            ->where('quantity', '>', 0)
            ->lockForUpdate()
            ->sum('quantity');

        if ($totalAvailable < $piecesNeeded) {
            throw new \RuntimeException("Insufficient Stock for {$productName}.");
        }
    }

    /**
     * @return array<int, array{batch_id: int, pieces: int}>
     */
    private function deductStockFefo(int $productId, int $branchId, int $piecesNeeded, string $productName): array
    {
        $batches = ProductQty::query()
            ->where('product_id', $productId)
            ->where('branch_id', $branchId)
            ->where('status', 'Active')
            ->where('quantity', '>', 0)
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

    private function branchIdOrFail(): int
    {
        $branchId = $this->branchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }
}
