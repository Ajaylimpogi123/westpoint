<?php

namespace Tests\Feature\Qa;

use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use App\Models\PosCart;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockOut;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * QA pass: Reports module (routes/report.php). Data is created through the
 * real POS / void / stock-in / stock-out routes wherever practical and the
 * report props are reconciled against the source tables.
 *
 * test_bug_* tests demonstrate confirmed defects and FAIL until fixed.
 */
class ReportsQaTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private User $staffB;

    private MedicineProduct $productB;

    private ProductQty $batchB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        $this->staffB = User::create([
            'name' => 'Staff B',
            'email' => 'staff-b@westpoint.test',
            'password' => Hash::make('password'),
            'role_id' => 1,
            'branch_id' => $this->branchB->id,
            'email_verified_at' => now(),
        ]);

        $this->productB = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Paracetamol',
            'dose' => '500mg',
            'form' => 'Tablet',
            'pack_size' => 10,
            'brand_name' => 'Bioflu',
            'retail_price' => 5.00,
            'wholesale_price' => 45.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);

        $this->batchB = ProductQty::create([
            'product_id' => $this->productB->id,
            'quantity' => 100,
            'status' => 'Active',
            'lot_number' => 'LOT-B1',
            'expiry' => now()->addYear()->toDateString(),
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    /**
     * Rings up a sale through POST /pos and returns it.
     *
     * @param  array<int, array{unit: string, qty: int, discount?: bool, product?: MedicineProduct}>  $lines
     */
    private function posSale(User $cashier, array $lines, string $method = 'cash', float $discountPercent = 0, array $extra = []): Sale
    {
        $cart = PosCart::create(['branch_id' => $cashier->branch_id, 'user_id' => $cashier->id]);
        $before = Sale::max('id') ?? 0;

        $product = $cashier->branch_id === $this->branchB->id ? $this->productB : $this->product;

        $this->actingAsWithSession($cashier)
            ->post('/pos', array_merge([
                'cart_id' => $cart->id,
                'items' => array_map(fn ($l) => [
                    'product_id' => ($l['product'] ?? $product)->id,
                    'unit_type' => $l['unit'],
                    'quantity_sold' => $l['qty'],
                    'apply_discount' => $l['discount'] ?? false,
                ], $lines),
                'payment_method' => $method,
                'discount_percent' => $discountPercent,
                'amount_received' => 100000,
                'idempotency_key' => 'pos-'.uniqid('', true),
            ], $extra))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $sale = Sale::where('id', '>', $before)->latest('id')->firstOrFail();

        return $sale;
    }

    /** @param array<int,int> $qtyByItemId */
    private function voidLines(User $user, Sale $sale, array $qtyByItemId): void
    {
        $this->actingAsWithSession($user)
            ->postJson(route('history.void', $sale), [
                'items' => collect($qtyByItemId)->map(fn ($q, $id) => [
                    'sale_item_id' => $id,
                    'quantity_returned' => $q,
                ])->values()->all(),
                'reason' => 'QA',
            ])
            ->assertOk();
    }

    private function props(string $url, ?User $as = null): array
    {
        $props = null;

        $this->actingAsWithSession($as ?? $this->admin)
            ->get($url)
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$props) {
                $props = $page->toArray()['props'];
            });

        return $props;
    }

    private function money($value): float
    {
        return round((float) $value, 2);
    }

    private function stockOutPayload(string $subtype, array $items, array $extra = []): array
    {
        return array_merge([
            'transaction_subtype' => $subtype,
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Issuer',
            'delivered_to' => 'ABC Clinic',
            'idempotency_key' => 'so-'.uniqid('', true),
            'items' => $items,
        ], $extra);
    }

    private function ledgerSum(string $type, string $from, string $to, ?int $branchId = null): int
    {
        return (int) DB::table('tbl_inventory_movement_logs')
            ->where('movement_type', $type)
            ->whereBetween('created_at', [$from, $to])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->sum('quantity');
    }

    // ------------------------------------------------------------------
    // access
    // ------------------------------------------------------------------

    public function test_every_report_route_is_admin_and_superadmin_only(): void
    {
        $routes = [
            'reports.index', 'reports.sales-summary', 'reports.sales-detail', 'reports.sales-detail.export',
            'reports.top-products', 'reports.sales-by-cashier', 'reports.stock-on-hand', 'reports.low-stock',
            'reports.expiry', 'reports.add-stock-history', 'reports.stock-in', 'reports.stock-out',
            'reports.stock-transfers', 'reports.movement-ledger', 'reports.void-returns',
        ];

        foreach ($routes as $name) {
            $this->get(route($name))->assertRedirect('/login');
        }

        foreach ($routes as $name) {
            $this->actingAsWithSession($this->staff)->get(route($name))->assertForbidden();
            $this->actingAsWithSession($this->admin)->get(route($name))->assertOk();
            $this->actingAsWithSession($this->superadmin)->get(route($name))->assertOk();
        }
    }

    // ------------------------------------------------------------------
    // sales reconciliation
    // ------------------------------------------------------------------

    public function test_sales_reports_reconcile_with_pos_sales_and_branch_filter(): void
    {
        // A: 3 pcs x 5.00 = 15.00 cash; 1 box x 45.00 with 20% line discount = 9.00 off, gcash.
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 3]], 'cash');
        $this->posSale($this->staff, [['unit' => 'Box', 'qty' => 1, 'discount' => true]], 'gcash', 20, ['reference_number' => 'G-1']);
        // B: 2 pcs = 10.00 cash.
        $this->posSale($this->staffB, [['unit' => 'Piece', 'qty' => 2]], 'cash');

        $src = DB::table('tbl_sales')->where('branch_id', $this->branchA->id)
            ->selectRaw('COUNT(*) c, SUM(gross_amount) g, SUM(discount_amount) d, SUM(net_amount - refunded_amount) n')->first();
        $this->assertSame([60.0, 9.0, 51.0], [$this->money($src->g), $this->money($src->d), $this->money($src->n)]);

        $a = $this->branchA->id;
        $summary = $this->props("/reports/sales-summary?branch_id={$a}")['data'];
        $this->assertSame(2, (int) $summary['totals']['transaction_count']);
        $this->assertSame(60.0, $this->money($summary['totals']['gross_amount']));
        $this->assertSame(9.0, $this->money($summary['totals']['discount_amount']));
        $this->assertSame(51.0, $this->money($summary['totals']['net_amount']));
        $this->assertSame(51.0, $this->money(collect($summary['byDay'])->sum('net_amount')));
        $this->assertSame(51.0, $this->money(collect($summary['byPaymentMethod'])->sum('total')));

        $detail = $this->props("/reports/sales-detail?branch_id={$a}");
        $this->assertCount(2, $detail['sales']['data']);
        $this->assertSame(51.0, $this->money($detail['totals']['net_total']));
        $this->assertSame(51.0, $this->money(collect($detail['paymentBreakdown'])->sum('total')));
        $this->assertTrue(collect($detail['sales']['data'])->every(fn ($r) => $r['branch_name'] === 'Main Branch'));

        $cashiers = $this->props("/reports/sales-by-cashier?branch_id={$a}")['cashiers'];
        $this->assertCount(1, $cashiers);
        $this->assertSame(51.0, $this->money($cashiers[0]['net_amount']));

        $top = $this->props("/reports/top-products?branch_id={$a}")['products'];
        $this->assertCount(1, $top);
        $this->assertSame(51.0, $this->money($top[0]['revenue']));

        $all = $this->props('/reports/sales-summary')['data'];
        $this->assertSame(3, (int) $all['totals']['transaction_count']);
        $this->assertSame(61.0, $this->money($all['totals']['net_amount']));

        $b = $this->props("/reports/sales-summary?branch_id={$this->branchB->id}")['data'];
        $this->assertSame(1, (int) $b['totals']['transaction_count']);
        $this->assertSame(10.0, $this->money($b['totals']['net_amount']));
    }

    public function test_partial_void_is_netted_in_detail_cashier_and_top_products(): void
    {
        $sale = $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 4]]); // 20.00
        $item = SaleItem::where('sale_id', $sale->id)->sole();
        $this->voidLines($this->staff, $sale, [$item->id => 1]); // refund 5.00

        $this->assertSame('Partially Voided', $sale->fresh()->status);

        $detail = $this->props('/reports/sales-detail');
        $this->assertSame(15.0, $this->money($detail['sales']['data'][0]['net_amount']));
        $this->assertSame(15.0, $this->money($detail['totals']['net_total']));
        $this->assertSame(15.0, $this->money($this->props('/reports/sales-by-cashier')['cashiers'][0]['net_amount']));

        $top = $this->props('/reports/top-products')['products'][0];
        $this->assertSame(3, (int) $top['units_sold']);
        $this->assertSame(15.0, $this->money($top['revenue']));

        $void = $this->props('/reports/void-returns');
        $this->assertSame(1, (int) $void['totals']['return_count']);
        $this->assertSame(5.0, $this->money($void['totals']['total_refunded']));
    }

    public function test_date_range_defaults_to_today_and_date_to_covers_the_whole_day(): void
    {
        Carbon::setTestNow('2026-10-20 23:59:59');
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 1]]);
        Carbon::setTestNow('2026-10-21 00:00:00');
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 2]]);
        Carbon::setTestNow('2026-10-21 10:00:00');

        $day1 = $this->props('/reports/sales-summary?date_from=2026-10-20&date_to=2026-10-20')['data']['totals'];
        $this->assertSame(1, (int) $day1['transaction_count']);
        $this->assertSame(5.0, $this->money($day1['net_amount']));

        $today = $this->props('/reports/sales-summary')['data']['totals'];
        $this->assertSame(1, (int) $today['transaction_count']);
        $this->assertSame(10.0, $this->money($today['net_amount']));

        $both = $this->props('/reports/sales-detail?date_from=2026-10-20&date_to=2026-10-21')['totals'];
        $this->assertSame(2, (int) $both['transaction_count']);
    }

    public function test_sales_detail_csv_export_columns_branch_filter_and_quoting(): void
    {
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 3]], 'cash', 0, ['customer_name' => 'Cruz, "Juan"']);
        $this->posSale($this->staffB, [['unit' => 'Piece', 'qty' => 1]]);

        $response = $this->actingAsWithSession($this->admin)
            ->get(route('reports.sales-detail.export', ['branch_id' => $this->branchA->id]));
        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));

        $rows = array_map('str_getcsv', array_filter(explode("\n", trim($response->streamedContent()))));
        $this->assertSame(['Invoice #', 'Reference #', 'Customer', 'Payment Method', 'Gross', 'Discount', 'Net', 'Cashier', 'Branch', 'Date'], $rows[0]);
        $this->assertCount(2, $rows);
        $this->assertSame('Cruz, "Juan"', $rows[1][2]);
        $this->assertSame('15.00', $rows[1][6]);
        $this->assertSame('Main Branch', $rows[1][8]);
    }

    // ------------------------------------------------------------------
    // inventory reconciliation
    // ------------------------------------------------------------------

    public function test_stock_on_hand_lists_only_active_batches_in_pieces_per_branch(): void
    {
        ProductQty::create(['product_id' => $this->product->id, 'quantity' => 7, 'status' => 'Inactive', 'lot_number' => 'INACT']);
        ProductQty::create(['product_id' => $this->product->id, 'quantity' => 9, 'status' => 'Deleted', 'lot_number' => 'DEL']);
        ProductQty::create(['product_id' => $this->product->id, 'quantity' => 11, 'status' => 'Expired', 'lot_number' => 'EXP', 'expiry' => now()->subDay()->toDateString()]);

        // Box stock-in through the route: 2 boxes x pack 10 = 20 pieces.
        $this->actingAsWithSession($this->staff)->post('/stock-in', [
            'supplier_name' => 'ABC Pharma',
            'delivery_date' => now()->toDateString(),
            'branch_id' => $this->branchA->id,
            'received_by' => 'Receiver',
            'idempotency_key' => 'si-'.uniqid(),
            'items' => [[
                'pd_id' => $this->product->id,
                'batch_number' => 'LOT-NEW',
                'expiry_date' => now()->addYears(2)->toDateString(),
                'quantity_received' => 2,
                'unit_type' => 'Box',
            ]],
        ])->assertSessionHasNoErrors();

        $stock = collect($this->props("/reports/stock-on-hand?branch_id={$this->branchA->id}")['stock']);
        $this->assertEqualsCanonicalizing(['LOT-001', 'LOT-NEW'], $stock->pluck('lot_number')->all());
        $this->assertSame(20, (int) $stock->firstWhere('lot_number', 'LOT-NEW')['quantity']);
        $this->assertSame(
            (int) ProductQty::where('product_id', $this->product->id)->where('status', 'Active')->sum('quantity'),
            (int) $stock->sum('quantity')
        );

        $stockIn = $this->props('/reports/stock-in');
        $this->assertSame(20, (int) $stockIn['totals']['pieces']);
        $this->assertSame(20, $this->ledgerSum(InventoryMovementLog::TYPE_STOCK_IN, now()->startOfDay(), now()->endOfDay()));
    }

    public function test_low_stock_threshold_boundary_and_branch_filter(): void
    {
        $this->batch->update(['quantity' => 10]); // threshold defaults to 10 -> low
        $this->batchB->update(['quantity' => 11]); // above threshold -> not low

        $low = collect($this->props('/reports/low-stock')['products']);
        $this->assertSame([$this->product->id], $low->pluck('product_id')->map(fn ($v) => (int) $v)->all());
        $this->assertSame(10, (int) $low[0]['total_quantity']);

        $this->assertCount(0, $this->props("/reports/low-stock?branch_id={$this->branchB->id}")['products']);
    }

    public function test_expiry_window_and_branch_filter(): void
    {
        $this->batch->update(['expiry' => now()->addDays(10)->toDateString()]);
        ProductQty::create(['product_id' => $this->product->id, 'quantity' => 5, 'status' => 'Active', 'lot_number' => 'FAR', 'expiry' => now()->addDays(100)->toDateString()]);
        ProductQty::create(['product_id' => $this->product->id, 'quantity' => 0, 'status' => 'Active', 'lot_number' => 'EMPTY', 'expiry' => now()->addDays(5)->toDateString()]);

        // Default window is 90 days; empty lots and lots beyond the window are excluded.
        $rows = collect($this->props('/reports/expiry')['batches']);
        $this->assertSame(['LOT-001'], $rows->pluck('lot_number')->all());
        $this->assertSame(100, (int) $rows[0]['quantity']);
        $this->assertCount(1, $this->props("/reports/expiry?branch_id={$this->branchA->id}")['batches']);
        $this->assertCount(0, $this->props("/reports/expiry?branch_id={$this->branchB->id}")['batches']);
    }

    public function test_stock_out_report_reconciles_with_ledger_and_batch_on_the_same_day(): void
    {
        // Returned to supplier: 1 box x 10 = 10 pieces deducted now.
        $this->actingAsWithSession($this->admin)->post(route('stock-out.store'), $this->stockOutPayload('Returned to supplier', [[
            'pd_id' => $this->product->id, 'products_qty_id' => $this->batch->id,
            'quantity_deducted' => 1, 'unit_type' => 'Box', 'pieces_per_box' => 10,
        ]]))->assertSessionHasNoErrors();

        // Two deliveries of 4 pieces; only the first is confirmed.
        foreach ([1, 2] as $_) {
            $this->actingAsWithSession($this->admin)->post(route('stock-out.store'), $this->stockOutPayload('Delivery to Customer', [[
                'pd_id' => $this->product->id, 'products_qty_id' => $this->batch->id,
                'quantity_deducted' => 4, 'unit_type' => 'Piece',
            ]]))->assertSessionHasNoErrors();
        }
        $first = StockOut::where('transaction_subtype', 'Delivery to Customer')->orderBy('stock_out_id')->firstOrFail();
        $this->actingAsWithSession($this->admin)->post(route('stock-out.confirm-delivery', $first))->assertSessionHas('success');

        $report = $this->props('/reports/stock-out');
        $this->assertSame(14, (int) $report['totals']['pieces']);
        $this->assertSame(4, (int) $report['totals']['pending_pieces']);
        $this->assertSame(-14, $this->ledgerSum(InventoryMovementLog::TYPE_STOCK_OUT, now()->startOfDay(), now()->endOfDay()));
        $this->assertSame(86, (int) $this->batch->fresh()->quantity);
    }

    // ------------------------------------------------------------------
    // confirmed defects (fail until fixed)
    // ------------------------------------------------------------------

    /** RPT-1 (fixed in qa-fix-batch-1): Top Products "Units Sold" adds Box counts and Piece counts together. */
    public function test_rpt1_top_products_units_sold_is_in_pieces(): void
    {
        // 2 boxes (20 pcs) + 3 pieces = 23 pieces left the shelf.
        $this->posSale($this->staff, [['unit' => 'Box', 'qty' => 2], ['unit' => 'Piece', 'qty' => 3]]);
        $this->assertSame(77, (int) $this->batch->fresh()->quantity);

        $top = $this->props('/reports/top-products')['products'][0];
        $this->assertSame(105.0, $this->money($top['revenue']));
        $this->assertSame(23, (int) $top['units_sold'], 'units_sold should be in pieces (2 Box x 10 + 3 Piece)');
    }

    /** RPT-2 (fixed in qa-fix-batch-1): Sales Summary offers a payment-method filter but never applies it. */
    public function test_rpt2_sales_summary_applies_payment_method_filter(): void
    {
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 3]], 'cash');           // 15.00
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 1]], 'gcash', 0, ['reference_number' => 'G-1']); // 5.00

        $data = $this->props('/reports/sales-summary?payment_method=gcash')['data'];
        $this->assertSame(1, (int) $data['totals']['transaction_count']);
        $this->assertSame(5.0, $this->money($data['totals']['net_amount']));
        $this->assertSame(['gcash'], collect($data['byPaymentMethod'])->pluck('payment_method')->all());
    }

    /** RPT-3 (fixed in qa-fix-batch-1): Export CSV link passes payment_method but the export drops it. */
    public function test_rpt3_sales_detail_export_applies_payment_method_filter(): void
    {
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 3]], 'cash');
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 1]], 'gcash', 0, ['reference_number' => 'G-1']);

        $page = $this->props('/reports/sales-detail?payment_method=gcash');
        $this->assertCount(1, $page['sales']['data']);

        $csv = $this->actingAsWithSession($this->admin)
            ->get(route('reports.sales-detail.export', ['payment_method' => 'gcash']))
            ->streamedContent();
        $rows = array_map('str_getcsv', array_filter(explode("\n", trim($csv))));

        $this->assertCount(2, $rows, 'export should contain the header + the 1 gcash sale shown on screen');
        $this->assertSame('gcash', $rows[1][3]);
    }

    /**
     * RPT-4: Sales Summary / Sales Detail cards show Gross and Discount
     * including refunded sales but Net after refunds, with no refunded
     * figure, so Gross - Discount != Net and the cards cannot be reconciled.
     */
    public function test_bug_rpt4_sales_cards_do_not_reconcile_after_a_void(): void
    {
        $sale = $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 3]]); // 15.00
        $item = SaleItem::where('sale_id', $sale->id)->sole();
        $this->voidLines($this->staff, $sale, [$item->id => 3]);
        $this->assertSame('Voided', $sale->fresh()->status);

        $t = $this->props('/reports/sales-summary')['data']['totals'];
        $refunded = (float) ($t['refunded_amount'] ?? 0);
        $this->assertSame(
            $this->money($t['net_amount']),
            $this->money($t['gross_amount'] - $t['discount_amount'] - $refunded),
            'Gross - Discount (- Refunded, if reported) must equal Net'
        );

        $d = $this->props('/reports/sales-detail')['totals'];
        $refunded = (float) ($d['refunded_total'] ?? $d['refunded_amount'] ?? 0);
        $this->assertSame(
            $this->money($d['net_total']),
            $this->money($d['gross_total'] - $d['discount_total'] - $refunded),
        );
    }

    /** RPT-5: Void/Returns "Items Returned" adds returned boxes and returned pieces together. */
    public function test_bug_rpt5_void_returns_items_returned_mixes_boxes_and_pieces(): void
    {
        $sale = $this->posSale($this->staff, [['unit' => 'Box', 'qty' => 1], ['unit' => 'Piece', 'qty' => 2]]);
        $items = SaleItem::where('sale_id', $sale->id)->pluck('id');
        $this->voidLines($this->staff, $sale, [$items[0] => 1, $items[1] => 2]);

        $restocked = (int) DB::table('tbl_sale_return_items')->sum('pieces_restocked');
        $this->assertSame(12, $restocked);

        $totals = $this->props('/reports/void-returns')['totals'];
        $this->assertSame(12, (int) $totals['items_returned'], 'items_returned should be pieces (1 Box x 10 + 2 Piece)');
    }

    /** RPT-6: a deleted medicine keeps appearing on Low Stock with 0 on hand. */
    public function test_bug_rpt6_low_stock_lists_deleted_medicines(): void
    {
        $this->actingAsWithSession($this->admin)
            ->delete("/medicine-inventory/{$this->product->id}")
            ->assertSessionHasNoErrors();
        $this->assertSame('Deleted', $this->product->fresh()->status);

        $ids = collect($this->props('/reports/low-stock')['products'])->pluck('product_id')->map(fn ($v) => (int) $v);
        $this->assertNotContains($this->product->id, $ids->all());
    }

    /** RPT-7: stock in Active-but-expired lots is counted as on-hand, hiding the product from Low Stock. */
    public function test_bug_rpt7_low_stock_counts_expired_unsellable_stock(): void
    {
        // The only stock is past expiry but still Active (expire job not yet run / not scheduled).
        $this->batch->update(['expiry' => now()->subDays(3)->toDateString()]);
        $this->assertSame(0, ProductQty::where('product_id', $this->product->id)->dispensable()->count());

        $ids = collect($this->props("/reports/low-stock?branch_id={$this->branchA->id}")['products'])
            ->pluck('product_id')->map(fn ($v) => (int) $v);
        $this->assertContains($this->product->id, $ids->all(), 'sellable stock is 0, product must be flagged low');
    }

    /** RPT-8: a medicine whose threshold was cleared (NULL) is never flagged, even at 0. */
    public function test_bug_rpt8_low_stock_skips_products_with_null_threshold(): void
    {
        $this->product->update(['stock_threshold' => null]);
        $this->batch->update(['quantity' => 0]);

        $ids = collect($this->props('/reports/low-stock')['products'])->pluck('product_id')->map(fn ($v) => (int) $v);
        $this->assertContains($this->product->id, $ids->all(), 'inventory screen treats NULL threshold as 10');
    }

    /** RPT-9: once inventory:expire-batches runs, expired lots with stock vanish from the Expiry report. */
    public function test_bug_rpt9_expiry_report_hides_expired_lots_still_holding_stock(): void
    {
        $this->batch->update(['expiry' => now()->subDays(2)->toDateString()]);
        $this->assertCount(1, $this->props('/reports/expiry')['batches']);

        $this->artisan('inventory:expire-batches')->assertSuccessful();
        $this->assertSame('Expired', $this->batch->fresh()->status);
        $this->assertSame(100, (int) $this->batch->fresh()->quantity);

        $this->assertCount(1, $this->props('/reports/expiry')['batches'], '100 expired pieces still need disposal');
    }

    /** RPT-10: a delivery confirmed on a later day is reported on its creation day, not when stock left. */
    public function test_bug_rpt10_stock_out_report_dates_deliveries_by_creation_not_deduction(): void
    {
        Carbon::setTestNow('2026-10-20 10:00:00');
        $this->actingAsWithSession($this->admin)->post(route('stock-out.store'), $this->stockOutPayload('Delivery to Customer', [[
            'pd_id' => $this->product->id, 'products_qty_id' => $this->batch->id,
            'quantity_deducted' => 5, 'unit_type' => 'Piece',
        ]]))->assertSessionHasNoErrors();

        Carbon::setTestNow('2026-10-22 10:00:00');
        $this->actingAsWithSession($this->admin)
            ->post(route('stock-out.confirm-delivery', StockOut::firstOrFail()))
            ->assertSessionHas('success');

        $ledger = -$this->ledgerSum(InventoryMovementLog::TYPE_STOCK_OUT, '2026-10-22 00:00:00', '2026-10-22 23:59:59');
        $this->assertSame(5, $ledger);

        $report = $this->props('/reports/stock-out?date_from=2026-10-22&date_to=2026-10-22');
        $this->assertSame($ledger, (int) $report['totals']['pieces'], 'pieces deducted on 22 Oct per ledger');
    }

    /** RPT-11: a fully voided sale leaves -0.01 net revenue in reports (refund over-rounded). */
    public function test_bug_rpt11_fully_voided_sale_leaves_rounding_residue_in_sales_reports(): void
    {
        // 3 pcs x 5.00 = 15.00, 26.6667% discount = 4.00 -> paid 11.00; per-unit refund 3.67 x 3 = 11.01.
        $sale = $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 3, 'discount' => true]], 'cash', 26.6667);
        $this->assertSame(11.0, $this->money($sale->net_amount));
        $item = SaleItem::where('sale_id', $sale->id)->sole();
        $this->voidLines($this->staff, $sale, [$item->id => 3]);

        $sale->refresh();
        $this->assertSame('Voided', $sale->status);
        $this->assertLessThanOrEqual((float) $sale->net_amount, (float) $sale->refunded_amount, 'refund exceeds amount paid');
        $this->assertSame(0.0, $this->money($this->props('/reports/sales-summary')['data']['totals']['net_amount']));
    }

    /**
     * RPT-12: Expiry's within_days arrives as a query-string string and is
     * passed straight to Carbon::addDays(), which throws a TypeError, so ANY
     * within_days value (even "120") is a 500.
     */
    public function test_bug_rpt12_expiry_within_days_filter_always_500s(): void
    {
        ProductQty::create(['product_id' => $this->product->id, 'quantity' => 5, 'status' => 'Active', 'lot_number' => 'FAR', 'expiry' => now()->addDays(100)->toDateString()]);
        $this->batch->update(['expiry' => now()->addDays(10)->toDateString()]);

        $rows = collect($this->props('/reports/expiry?within_days=120')['batches']);
        $this->assertSame(['LOT-001', 'FAR'], $rows->pluck('lot_number')->all());
    }

    /** RPT-13: a malformed date_to 500s instead of being validated or ignored. */
    public function test_bug_rpt13_malformed_date_to_returns_server_error(): void
    {
        $this->actingAsWithSession($this->admin)->get('/reports/sales-summary?date_to=not-a-date')->assertStatus(200);
    }

    /** RPT-14: CSV export writes user-entered text starting with "=" unescaped (spreadsheet formula injection). */
    public function test_bug_rpt14_csv_export_does_not_neutralise_formula_cells(): void
    {
        $this->posSale($this->staff, [['unit' => 'Piece', 'qty' => 1]], 'cash', 0, ['customer_name' => '=HYPERLINK("http://x","y")']);

        $csv = $this->actingAsWithSession($this->admin)->get(route('reports.sales-detail.export'))->streamedContent();
        $rows = array_map('str_getcsv', array_filter(explode("\n", trim($csv))));

        $this->assertStringStartsNotWith('=', $rows[1][2]);
    }
}
