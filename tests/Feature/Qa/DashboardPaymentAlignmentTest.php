<?php

namespace Tests\Feature\Qa;

use App\Models\Branch;
use App\Models\MedicineProduct;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * QA black-box tests for dashboard-payment-alignment (see
 * .claude/handoff/dashboard-payment-alignment.md, AC-6..AC-20).
 *
 * Fixtures are written straight to tbl_sales / tbl_sales_items, then the
 * dashboard is read through its HTTP routes and the Inertia props asserted.
 */
class DashboardPaymentAlignmentTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private const NOW = '2026-09-16 12:00:00'; // Wednesday

    private const POS_METHODS = [
        'cash' => 'Cash',
        'gcash' => 'GCash',
        'debit_card' => 'Debit Card',
        'credit_card' => 'Credit Card',
        'PH_GAMOT' => 'PH GAMOT',
        'bank_transfer' => 'Bank Transfer',
        'others' => 'Others',
    ];

    private int $invoiceSeq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse(self::NOW));
        $this->seedWestpoint();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private function makeProduct(?string $form, int $packSize = 10, string $name = 'Med'): MedicineProduct
    {
        return MedicineProduct::create([
            'branch_id' => $this->branchA->id,
            'med_name' => $name,
            'dose' => '10mg',
            'form' => $form,
            'pack_size' => $packSize,
            'brand_name' => 'QA',
            'retail_price' => 10.00,
            'wholesale_price' => 90.00,
            'status' => 'Active',
            'is_generic' => false,
        ]);
    }

    /**
     * @param  array<int, array{product?: MedicineProduct, unit?: string, qty?: int, total: float, discount?: float, returned?: int, refunded?: float}>  $items
     */
    private function makeSale(
        Branch $branch,
        string $method,
        array $items,
        string $status = Sale::STATUS_COMPLETED,
        ?string $createdAt = null
    ): Sale {
        $gross = array_sum(array_map(fn ($i) => $i['total'], $items));
        $discount = array_sum(array_map(fn ($i) => $i['discount'] ?? 0, $items));
        $refunded = array_sum(array_map(fn ($i) => $i['refunded'] ?? 0, $items));
        $createdAt = $createdAt ? Carbon::parse($createdAt) : Carbon::now();

        $sale = Sale::forceCreate([
            'invoice_number' => 'QA-'.(++$this->invoiceSeq),
            'branch_id' => $branch->id,
            'user_id' => $this->staff->id,
            'gross_amount' => $gross,
            'discount_amount' => $discount,
            'net_amount' => round($gross - $discount, 2),
            'amount_received' => round($gross - $discount, 2),
            'change_due' => 0,
            'status' => $status,
            'refunded_amount' => $refunded,
            'payment_method' => $method,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        foreach ($items as $item) {
            $qty = $item['qty'] ?? 1;
            SaleItem::forceCreate([
                'sale_id' => $sale->id,
                'product_id' => ($item['product'] ?? $this->product)->id,
                'products_qty_id' => null,
                'unit_type' => $item['unit'] ?? 'Piece',
                'quantity_sold' => $qty,
                'returned_quantity' => $item['returned'] ?? 0,
                'price_used' => round($item['total'] / max($qty, 1), 2),
                'total_price' => $item['total'],
                'discount_amount' => $item['discount'] ?? 0,
                'refunded_amount' => $item['refunded'] ?? 0,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }

        return $sale;
    }

    private function actAs(User $user)
    {
        return $this->actingAsWithSession($user);
    }

    private function props(User $user, array $query = [], string $route = 'dashboard'): array
    {
        $props = null;

        $this->actAs($user)
            ->get(route($route, $query))
            ->assertOk()
            ->assertInertia(function (Assert $page) use (&$props) {
                $page->component('Dashboard');
                $props = $page->toArray()['props'];
            });

        return $props;
    }

    private function assertMoney(float $expected, $actual, string $message = ''): void
    {
        $this->assertEqualsWithDelta($expected, (float) $actual, 0.005, $message);
    }

    private function breakdown(array $props): array
    {
        $chart = $props['charts']['productBreakdown'];

        return array_combine($chart['labels'], array_map('floatval', $chart['values']));
    }

    private function topById(array $props): array
    {
        $out = [];
        foreach ($props['topMedicines'] as $row) {
            $out[$row['id']] = $row;
        }

        return $out;
    }

    private function branchPerf(array $props): array
    {
        $out = [];
        foreach ($props['branchPerformance'] as $row) {
            $out[$row['id']] = $row;
        }

        return $out;
    }

    private function trendFor(array $props, string $monthLabel): float
    {
        $trend = $props['charts']['revenueTrend'];
        $idx = array_search($monthLabel, $trend['labels'], true);
        $this->assertNotFalse($idx, "revenueTrend has no {$monthLabel}");

        return (float) $trend['values'][$idx];
    }

    // ------------------------------------------------------------------
    // payment methods
    // ------------------------------------------------------------------

    /** AC-6 */
    public function test_payment_methods_prop_lists_pos_methods_in_pos_order_then_delivery(): void
    {
        $props = $this->props($this->admin, [], 'admin-dashboard');

        $expected = [];
        foreach (self::POS_METHODS as $value => $label) {
            $expected[] = ['value' => $value, 'label' => $label];
        }
        $expected[] = ['value' => 'delivery_to_customer', 'label' => 'Delivery to Customer'];

        $this->assertSame($expected, $props['paymentMethods']);
    }

    /** AC-7, AC-8 */
    public function test_every_payment_method_filter_is_honoured_and_slices_add_up(): void
    {
        $amounts = [
            'cash' => 10, 'gcash' => 20, 'debit_card' => 30, 'credit_card' => 40,
            'PH_GAMOT' => 50, 'bank_transfer' => 60, 'others' => 70,
        ];
        foreach ($amounts as $method => $amount) {
            $this->makeSale($this->branchA, $method, [['total' => $amount]]);
        }
        $this->makeSale($this->branchA, 'Delivery to Customer', [['total' => 80]]);
        $this->makeSale($this->branchB, 'Dispensed to patient', [['total' => 5]]);

        $all = $this->props($this->superadmin, [], 'superadmin-dashboard');
        $this->assertSame('all', $all['filters']['payment_method']);
        $this->assertNull($all['paymentMethodLabel']);
        $this->assertMoney(365, $all['stats']['totalRevenue']);
        $this->assertSame(9, $all['stats']['totalTransactions']);

        $sliceSum = 0.0;
        foreach (self::POS_METHODS as $method => $label) {
            $p = $this->props($this->superadmin, ['payment_method' => $method], 'superadmin-dashboard');
            $this->assertSame($method, $p['filters']['payment_method'], "filter echo for {$method}");
            $this->assertSame($label, $p['paymentMethodLabel'], "label for {$method}");
            $this->assertMoney($amounts[$method], $p['stats']['totalRevenue'], "revenue for {$method}");
            $this->assertSame(1, $p['stats']['totalTransactions'], "transactions for {$method}");
            $this->assertMoney($amounts[$method], array_sum($this->breakdown($p)), "breakdown for {$method}");
            $sliceSum += (float) $p['stats']['totalRevenue'];
        }

        $delivery = $this->props($this->superadmin, ['payment_method' => 'delivery_to_customer'], 'superadmin-dashboard');
        $this->assertSame('delivery_to_customer', $delivery['filters']['payment_method']);
        $this->assertSame('Delivery to Customer', $delivery['paymentMethodLabel']);
        $this->assertMoney(85, $delivery['stats']['totalRevenue']);
        $this->assertSame(2, $delivery['stats']['totalTransactions']);
        $sliceSum += (float) $delivery['stats']['totalRevenue'];

        $this->assertMoney((float) $all['stats']['totalRevenue'], $sliceSum, 'per-method slices must add up to all');
    }

    /** AC-9 */
    public function test_unknown_payment_method_falls_back_to_all(): void
    {
        $this->makeSale($this->branchA, 'cash', [['total' => 10]]);
        $this->makeSale($this->branchA, 'PH_GAMOT', [['total' => 20]]);

        // (Leading/trailing spaces are trimmed by TrimStrings, so " PH_GAMOT" is valid input.)
        foreach (['bitcoin', 'ph_gamot', 'Delivery to Customer', 'Dispensed to patient'] as $bad) {
            $p = $this->props($this->admin, ['payment_method' => $bad], 'admin-dashboard');
            $this->assertSame('all', $p['filters']['payment_method'], "fallback for '{$bad}'");
            $this->assertNull($p['paymentMethodLabel']);
            $this->assertMoney(30, $p['stats']['totalRevenue']);
            $this->assertSame(2, $p['stats']['totalTransactions']);
        }
    }

    // ------------------------------------------------------------------
    // voids and refunds
    // ------------------------------------------------------------------

    /** AC-10, AC-11 */
    public function test_voided_sales_excluded_and_partial_refunds_netted(): void
    {
        $this->makeSale($this->branchA, 'cash', [['qty' => 4, 'total' => 100]]);
        $this->makeSale($this->branchA, 'cash', [
            ['qty' => 4, 'total' => 100, 'returned' => 1, 'refunded' => 25],
        ], Sale::STATUS_PARTIALLY_VOIDED);
        $this->makeSale($this->branchA, 'cash', [
            ['qty' => 2, 'total' => 50, 'returned' => 2, 'refunded' => 50],
        ], Sale::STATUS_VOIDED);

        $p = $this->props($this->admin, [], 'admin-dashboard');

        $this->assertMoney(175, $p['stats']['totalRevenue']);
        $this->assertSame(2, $p['stats']['totalTransactions']);
        $this->assertSame(1, $p['stats']['voidedTransactions']);
        $this->assertMoney(75, $p['stats']['totalRefunded']);

        $top = $this->topById($p);
        $this->assertSame(7, $top[$this->product->id]['total_quantity']);
        $this->assertMoney(175, $top[$this->product->id]['total_revenue']);

        $this->assertMoney(175, $this->breakdown($p)['Tablet']);

        $perf = $this->branchPerf($p);
        $this->assertMoney(175, $perf[$this->branchA->id]['total_revenue']);
        $this->assertSame(2, $perf[$this->branchA->id]['transaction_count']);

        $this->assertMoney(175, $this->trendFor($p, '09/2026'));
    }

    // ------------------------------------------------------------------
    // period filter
    // ------------------------------------------------------------------

    /** AC-12 */
    public function test_period_filter_applies_to_every_card_except_revenue_trend(): void
    {
        $this->makeSale($this->branchA, 'cash', [['qty' => 1, 'total' => 10]], Sale::STATUS_COMPLETED, '2026-09-16 09:00:00');
        $this->makeSale($this->branchA, 'cash', [['qty' => 2, 'total' => 20]], Sale::STATUS_COMPLETED, '2026-09-14 09:00:00');
        $this->makeSale($this->branchA, 'cash', [['qty' => 4, 'total' => 40]], Sale::STATUS_COMPLETED, '2026-09-02 09:00:00');
        $this->makeSale($this->branchA, 'cash', [['qty' => 8, 'total' => 80]], Sale::STATUS_COMPLETED, '2026-08-20 09:00:00');

        $cases = [
            'all' => [[], 150, 4, 15],
            'daily' => [['stats_period' => 'daily', 'stats_date' => '2026-09-16'], 10, 1, 1],
            'weekly' => [['stats_period' => 'weekly', 'stats_date' => '2026-09-16'], 30, 2, 3],
            'weekly-sunday' => [['stats_period' => 'weekly', 'stats_date' => '2026-09-20'], 30, 2, 3],
            'monthly' => [['stats_period' => 'monthly', 'stats_date' => '2026-09'], 70, 3, 7],
            'monthly-aug' => [['stats_period' => 'monthly', 'stats_date' => '2026-08'], 80, 1, 8],
        ];

        foreach ($cases as $name => [$query, $revenue, $tx, $qty]) {
            $p = $this->props($this->admin, $query, 'admin-dashboard');

            $this->assertMoney($revenue, $p['stats']['totalRevenue'], "{$name}: stats revenue");
            $this->assertSame($tx, $p['stats']['totalTransactions'], "{$name}: stats transactions");

            $top = $this->topById($p);
            $this->assertSame($qty, $top[$this->product->id]['total_quantity'] ?? null, "{$name}: topMedicines qty");
            $this->assertMoney($revenue, $top[$this->product->id]['total_revenue'], "{$name}: topMedicines revenue");

            $this->assertMoney($revenue, array_sum($this->breakdown($p)), "{$name}: productBreakdown");

            $perf = $this->branchPerf($p);
            $this->assertMoney($revenue, $perf[$this->branchA->id]['total_revenue'], "{$name}: branchPerformance");
            $this->assertSame($tx, $perf[$this->branchA->id]['transaction_count'], "{$name}: branchPerformance count");

            $cmp = $p['charts']['branchComparison'];
            $idx = array_search($this->branchA->branch_name, $cmp['labels'], true);
            $this->assertMoney($revenue, $cmp['values'][$idx], "{$name}: branchComparison");

            // revenueTrend ignores the period by design.
            $this->assertCount(6, $p['charts']['revenueTrend']['labels'], "{$name}: trend months");
            $this->assertMoney(80, $this->trendFor($p, '08/2026'), "{$name}: trend Aug");
            $this->assertMoney(70, $this->trendFor($p, '09/2026'), "{$name}: trend Sep");
        }
    }

    // ------------------------------------------------------------------
    // units, discounts, categories
    // ------------------------------------------------------------------

    /** AC-13 */
    public function test_top_medicines_rank_by_pieces_not_raw_box_and_piece_counts(): void
    {
        // product: pack 10 -> 2 Box + 5 Piece = 25 pcs (raw 7)
        $boxed = $this->makeProduct('Capsule', 12, 'Boxed'); // 3 Box = 36 pcs (raw 3)
        $loose = $this->makeProduct('Syrup', 1, 'Loose');    // 30 Piece = 30 pcs (raw 30)

        $this->makeSale($this->branchA, 'cash', [
            ['product' => $this->product, 'unit' => 'Box', 'qty' => 2, 'total' => 90],
            ['product' => $this->product, 'unit' => 'Piece', 'qty' => 5, 'total' => 25],
            ['product' => $boxed, 'unit' => 'Box', 'qty' => 3, 'total' => 270],
            ['product' => $loose, 'unit' => 'Piece', 'qty' => 30, 'total' => 300],
        ]);

        $p = $this->props($this->admin, [], 'admin-dashboard');

        $ids = array_column($p['topMedicines'], 'id');
        $this->assertSame([$boxed->id, $loose->id, $this->product->id], $ids);

        $top = $this->topById($p);
        $this->assertSame(36, $top[$boxed->id]['total_quantity']);
        $this->assertSame(30, $top[$loose->id]['total_quantity']);
        $this->assertSame(25, $top[$this->product->id]['total_quantity']);
        $this->assertSame(10, $top[$this->product->id]['pack_size']);
        $this->assertSame(12, $top[$boxed->id]['pack_size']);
        $this->assertMoney(115, $top[$this->product->id]['total_revenue']);
    }

    /** AC-14 */
    public function test_item_revenue_is_net_of_discount_and_matches_totals(): void
    {
        $syrup = $this->makeProduct('Syrup', 1, 'Syrup');

        $this->makeSale($this->branchA, 'cash', [
            ['product' => $this->product, 'qty' => 10, 'total' => 100, 'discount' => 20],
            ['product' => $syrup, 'qty' => 5, 'total' => 50],
        ]);
        $this->makeSale($this->branchA, 'gcash', [
            ['product' => $syrup, 'qty' => 2, 'total' => 20, 'discount' => 4],
        ]);

        $p = $this->props($this->admin, [], 'admin-dashboard');

        $this->assertMoney(146, $p['stats']['totalRevenue']);

        $top = $this->topById($p);
        $this->assertMoney(80, $top[$this->product->id]['total_revenue']);
        $this->assertMoney(66, $top[$syrup->id]['total_revenue']);

        $bd = $this->breakdown($p);
        $this->assertMoney(80, $bd['Tablet']);
        $this->assertMoney(66, $bd['Syrup']);
        $this->assertMoney((float) $p['stats']['totalRevenue'], array_sum($bd));
    }

    /** AC-15 */
    public function test_blank_forms_collapse_into_one_uncategorized_slice(): void
    {
        $null = $this->makeProduct(null, 1, 'NullForm');
        $empty = $this->makeProduct('', 1, 'EmptyForm');
        $spaces = $this->makeProduct('   ', 1, 'SpaceForm');

        $this->makeSale($this->branchA, 'cash', [
            ['product' => $null, 'total' => 10],
            ['product' => $empty, 'total' => 20],
            ['product' => $spaces, 'total' => 30],
            ['product' => $this->product, 'total' => 5],
        ]);

        $p = $this->props($this->admin, [], 'admin-dashboard');
        $labels = $p['charts']['productBreakdown']['labels'];

        $this->assertSame(1, count(array_keys($labels, 'Uncategorized', true)), 'exactly one Uncategorized slice');
        $this->assertSame(count($labels), count(array_unique($labels)), 'no duplicate labels');
        $bd = $this->breakdown($p);
        $this->assertMoney(60, $bd['Uncategorized']);
        $this->assertMoney(5, $bd['Tablet']);
    }

    // ------------------------------------------------------------------
    // roles and branch isolation
    // ------------------------------------------------------------------

    /** AC-16 */
    public function test_staff_only_ever_sees_own_branch(): void
    {
        $onlyInB = $this->makeProduct('Ointment', 1, 'OnlyInB');

        $this->makeSale($this->branchA, 'cash', [['qty' => 2, 'total' => 100]]);
        $this->makeSale($this->branchB, 'cash', [['product' => $onlyInB, 'qty' => 50, 'total' => 200]]);

        foreach (['dashboard', 'admin-dashboard', 'superadmin-dashboard'] as $route) {
            foreach ([[], ['branch_id' => $this->branchB->id], ['branch_id' => 'all']] as $query) {
                $p = $this->props($this->staff, $query, $route);
                $ctx = $route.' '.json_encode($query);

                $this->assertSame((string) $this->branchA->id, (string) $p['filters']['branch_id'], $ctx);
                $this->assertMoney(100, $p['stats']['totalRevenue'], $ctx);
                $this->assertSame(1, $p['stats']['totalTransactions'], $ctx);
                $this->assertNotContains($onlyInB->id, array_column($p['topMedicines'], 'id'), $ctx);
                $this->assertArrayNotHasKey('Ointment', $this->breakdown($p), $ctx);
                $this->assertMoney(100, $this->trendFor($p, '09/2026'), $ctx);
                $this->assertSame([], $p['branches'], $ctx);
                $this->assertSame([], $p['branchPerformance'], $ctx);
                $this->assertNull($p['charts']['branchComparison'], $ctx);
                $this->assertFalse($p['canViewAllBranches'], $ctx);
                $this->assertSame('Main Branch', $p['branchName'], $ctx);
            }
        }
    }

    /** AC-17 */
    public function test_staff_without_session_branch_is_forbidden(): void
    {
        $this->actingAs($this->staff)
            ->withSession(['role_id' => 1])
            ->get(route('dashboard'))
            ->assertForbidden();
    }

    /** AC-18 */
    public function test_admin_and_superadmin_branch_selection_and_fallbacks(): void
    {
        $empty = Branch::create(['branch_name' => 'Empty Branch']);
        $deleted = Branch::create(['branch_name' => 'Zed Deleted Branch']);

        $this->makeSale($this->branchA, 'cash', [['total' => 100]]);
        $this->makeSale($this->branchB, 'gcash', [['total' => 200]]);
        $this->makeSale($deleted, 'cash', [['total' => 1000]]);
        $deleted->delete();

        foreach ([[$this->admin, 'admin-dashboard'], [$this->superadmin, 'superadmin-dashboard']] as [$user, $route]) {
            $all = $this->props($user, [], $route);
            $this->assertSame('all', $all['filters']['branch_id']);
            $this->assertTrue($all['canViewAllBranches']);
            $this->assertNull($all['branchName']);

            $perfIds = array_column($all['branchPerformance'], 'id');
            $this->assertContains($this->branchA->id, $perfIds);
            $this->assertContains($this->branchB->id, $perfIds);
            $this->assertContains($empty->id, $perfIds, 'branches with 0 sales are listed');
            $this->assertNotContains($deleted->id, $perfIds, 'soft-deleted branches are not listed');
            $this->assertSame(
                array_column($all['branchPerformance'], 'branch_name'),
                $all['charts']['branchComparison']['labels']
            );
            $names = array_column($all['branchPerformance'], 'branch_name');
            $sorted = $names;
            sort($sorted);
            $this->assertSame($sorted, $names, 'branchPerformance sorted by name');

            $perf = $this->branchPerf($all);
            $this->assertMoney(0, $perf[$empty->id]['total_revenue']);
            $this->assertSame(0, $perf[$empty->id]['transaction_count']);

            $onlyB = $this->props($user, ['branch_id' => $this->branchB->id], $route);
            $this->assertSame((string) $this->branchB->id, (string) $onlyB['filters']['branch_id']);
            $this->assertSame('Second Branch', $onlyB['branchName']);
            $this->assertMoney(200, $onlyB['stats']['totalRevenue']);
            $this->assertSame(1, $onlyB['stats']['totalTransactions']);
            $this->assertContains($this->branchA->id, array_column($onlyB['branchPerformance'], 'id'), 'branchPerformance still lists every branch');

            $bGcash = $this->props($user, ['branch_id' => $this->branchB->id, 'payment_method' => 'cash'], $route);
            $this->assertMoney(0, $bGcash['stats']['totalRevenue']);
            $perf = $this->branchPerf($bGcash);
            $this->assertMoney(100, $perf[$this->branchA->id]['total_revenue'], 'branchPerformance respects payment filter');
            $this->assertMoney(0, $perf[$this->branchB->id]['total_revenue']);

            foreach (['999999', 'abc', (string) $deleted->id, '-1'] as $bad) {
                $p = $this->props($user, ['branch_id' => $bad], $route);
                $this->assertSame('all', $p['filters']['branch_id'], "branch_id={$bad} falls back to all");
                $this->assertNull($p['branchName']);
            }
        }
    }

    // ------------------------------------------------------------------
    // filter validation, auth
    // ------------------------------------------------------------------

    /** AC-19 */
    public function test_invalid_period_and_dates_fall_back_without_errors(): void
    {
        $this->makeSale($this->branchA, 'cash', [['total' => 10]]);

        $p = $this->props($this->admin, ['stats_period' => 'yearly'], 'admin-dashboard');
        $this->assertSame('all', $p['filters']['stats_period']);
        $this->assertNull($p['filters']['stats_date']);

        foreach (['2026-13-45', '2026-02-30', 'abc', '2026-9-1'] as $bad) {
            $p = $this->props($this->admin, ['stats_period' => 'daily', 'stats_date' => $bad], 'admin-dashboard');
            $this->assertSame('daily', $p['filters']['stats_period']);
            $this->assertSame('2026-09-16', $p['filters']['stats_date'], "daily {$bad}");
            $this->assertMoney(10, $p['stats']['totalRevenue']);
        }

        foreach (['2026-13', 'abc', '2026-09-16'] as $bad) {
            $p = $this->props($this->admin, ['stats_period' => 'monthly', 'stats_date' => $bad], 'admin-dashboard');
            $this->assertSame('2026-09', $p['filters']['stats_date'], "monthly {$bad}");
        }
    }

    /** AC-19: month overflow on the 29th-31st. */
    public function test_monthly_february_resolves_to_february_on_the_thirtieth(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-30 12:00:00'));

        $this->makeSale($this->branchA, 'cash', [['total' => 11]], Sale::STATUS_COMPLETED, '2026-02-10 10:00:00');
        $this->makeSale($this->branchA, 'cash', [['total' => 22]], Sale::STATUS_COMPLETED, '2026-03-02 10:00:00');

        $p = $this->props($this->admin, ['stats_period' => 'monthly', 'stats_date' => '2026-02'], 'admin-dashboard');

        $this->assertSame('02/2026', $p['statsPeriodLabel']);
        $this->assertMoney(11, $p['stats']['totalRevenue']);
        $this->assertSame(1, $p['stats']['totalTransactions']);
    }

    /** AC-20 */
    public function test_guest_is_redirected_to_login(): void
    {
        foreach (['dashboard', 'admin-dashboard', 'superadmin-dashboard'] as $route) {
            $this->get(route($route))->assertRedirect(route('login'));
        }
    }
}
