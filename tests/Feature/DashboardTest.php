<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Models\MedicineProduct;
use App\Models\Sale;
use App\Models\SaleItem;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        // Wednesday; week = Mon 14 – Sun 20 Sep 2026.
        Carbon::setTestNow('2026-09-16 12:00:00');
        $this->seedWestpoint();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * @param  array<int, array{product?: MedicineProduct, unit_type?: string, qty: int, total: float, discount?: float, returned?: int, refunded?: float}>  $lines
     */
    private function makeSale(array $attributes, array $lines = []): Sale
    {
        $sale = Sale::forceCreate(array_merge([
            'invoice_number' => 'INV-'.Str::random(10),
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
            'gross_amount' => 0,
            'discount_amount' => 0,
            'net_amount' => 0,
            'refunded_amount' => 0,
            'status' => Sale::STATUS_COMPLETED,
            'payment_method' => 'cash',
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));

        foreach ($lines as $line) {
            SaleItem::create([
                'sale_id' => $sale->id,
                'product_id' => ($line['product'] ?? $this->product)->id,
                'unit_type' => $line['unit_type'] ?? 'Piece',
                'quantity_sold' => $line['qty'],
                'returned_quantity' => $line['returned'] ?? 0,
                'price_used' => $line['total'] / max($line['qty'], 1),
                'total_price' => $line['total'],
                'discount_amount' => $line['discount'] ?? 0,
                'refunded_amount' => $line['refunded'] ?? 0,
            ]);
        }

        return $sale;
    }

    private function makeProduct(string $name, ?string $form, int $packSize = 1): MedicineProduct
    {
        return MedicineProduct::create([
            'branch_id' => $this->branchA->id,
            'med_name' => $name,
            'dose' => '10mg',
            'form' => $form,
            'pack_size' => $packSize,
            'brand_name' => 'Generic',
            'retail_price' => 1,
            'wholesale_price' => 1,
            'status' => 'Active',
            'is_generic' => true,
        ]);
    }

    public function test_payment_method_options_follow_pos_order_and_labels(): void
    {
        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('paymentMethods', [
                    ['value' => 'cash', 'label' => 'Cash'],
                    ['value' => 'gcash', 'label' => 'GCash'],
                    ['value' => 'debit_card', 'label' => 'Debit Card'],
                    ['value' => 'credit_card', 'label' => 'Credit Card'],
                    ['value' => 'PH_GAMOT', 'label' => 'PH GAMOT'],
                    ['value' => 'bank_transfer', 'label' => 'Bank Transfer'],
                    ['value' => 'others', 'label' => 'Others'],
                    ['value' => 'delivery_to_customer', 'label' => 'Delivery to Customer'],
                ])
                ->where('filters.payment_method', 'all')
                ->where('paymentMethodLabel', null)
            );

        $this->assertSame(
            ['cash', 'gcash', 'debit_card', 'credit_card', 'PH_GAMOT', 'bank_transfer', 'others'],
            PaymentMethod::posValues()
        );
    }

    public static function newPaymentMethodProvider(): array
    {
        return [
            'PH GAMOT' => ['PH_GAMOT', 'PH GAMOT'],
            'bank transfer' => ['bank_transfer', 'Bank Transfer'],
            'others' => ['others', 'Others'],
        ];
    }

    /**
     * @dataProvider newPaymentMethodProvider
     */
    public function test_new_pos_payment_methods_filter_instead_of_falling_back_to_all(string $value, string $label): void
    {
        $this->makeSale(['payment_method' => 'cash', 'net_amount' => 100]);
        $this->makeSale(['payment_method' => $value, 'net_amount' => 40]);

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?payment_method='.$value)
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.payment_method', $value)
                ->where('paymentMethodLabel', $label)
                ->where('stats.totalRevenue', 40)
                ->where('stats.totalTransactions', 1)
            );
    }

    public function test_delivery_to_customer_covers_legacy_rows_and_slices_sum_to_all(): void
    {
        $this->makeSale(['payment_method' => 'cash', 'net_amount' => 100]);
        $this->makeSale(['payment_method' => 'PH_GAMOT', 'net_amount' => 50]);
        $this->makeSale(['payment_method' => 'Delivery to Customer', 'net_amount' => 30]);
        $this->makeSale(['payment_method' => 'Dispensed to patient', 'net_amount' => 20]);

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?payment_method=delivery_to_customer')
            ->assertInertia(fn (Assert $page) => $page
                ->where('paymentMethodLabel', 'Delivery to Customer')
                ->where('stats.totalRevenue', 50)
                ->where('stats.totalTransactions', 2)
            );

        $sum = 0.0;
        foreach (PaymentMethod::filterOptions() as $option) {
            $sum += $this->actingAsWithSession($this->admin)
                ->get('/admin-dashboard?payment_method='.$option['value'])
                ->viewData('page')['props']['stats']['totalRevenue'];
        }

        $this->assertEqualsWithDelta(200.0, $sum, 0.001);
    }

    public function test_unknown_payment_method_falls_back_to_all(): void
    {
        $this->makeSale(['payment_method' => 'cash', 'net_amount' => 100]);
        $this->makeSale(['payment_method' => 'gcash', 'net_amount' => 10]);

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?payment_method=bitcoin')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.payment_method', 'all')
                ->where('paymentMethodLabel', null)
                ->where('stats.totalRevenue', 110)
                ->where('stats.totalTransactions', 2)
            );
    }

    public function test_voided_sales_are_excluded_and_refunds_are_subtracted(): void
    {
        $this->makeSale(['net_amount' => 100], [['qty' => 20, 'total' => 100]]);
        // Partially voided: 4 of 10 pieces returned, 20.00 refunded.
        $this->makeSale(
            ['net_amount' => 50, 'refunded_amount' => 20, 'status' => Sale::STATUS_PARTIALLY_VOIDED],
            [['qty' => 10, 'total' => 50, 'returned' => 4, 'refunded' => 20]]
        );
        // Fully voided with a centavo of rounding residue.
        $this->makeSale(
            ['net_amount' => 30, 'refunded_amount' => 29.99, 'status' => Sale::STATUS_VOIDED],
            [['qty' => 6, 'total' => 30, 'returned' => 6, 'refunded' => 29.99]]
        );

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.totalRevenue', 130)
                ->where('stats.totalTransactions', 2)
                ->where('stats.totalRefunded', 49.99)
                ->where('stats.voidedTransactions', 1)
                ->where('topMedicines.0.total_quantity', 26)
                ->where('topMedicines.0.total_revenue', 130)
                ->where('charts.productBreakdown.values', [130])
                ->where('charts.revenueTrend.values.5', 130)
                ->where('branchPerformance.0.total_revenue', 130)
                ->where('branchPerformance.0.transaction_count', 2)
            );
    }

    public function test_top_medicines_rank_in_pieces_across_box_and_piece_lines_with_net_revenue(): void
    {
        // pack_size 10: 2 boxes + 3 pieces = 23 pieces, discount 9.00.
        $this->makeSale(['net_amount' => 96], [
            ['unit_type' => 'Box', 'qty' => 2, 'total' => 90, 'discount' => 9],
            ['unit_type' => 'Piece', 'qty' => 3, 'total' => 15],
        ]);

        // 15 pieces of a piece-only product: more "lines" by raw quantity_sold
        // (15 vs 5) but fewer pieces than Paracetamol.
        $other = $this->makeProduct('Cetirizine', 'Tablet');
        $this->makeSale(['net_amount' => 15], [
            ['product' => $other, 'qty' => 15, 'total' => 15],
        ]);

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->has('topMedicines', 2)
                ->where('topMedicines.0.id', $this->product->id)
                ->where('topMedicines.0.name', 'Paracetamol 500mg Tablet')
                ->where('topMedicines.0.pack_size', 10)
                ->where('topMedicines.0.total_quantity', 23)
                ->where('topMedicines.0.total_revenue', 96)
                ->where('topMedicines.1.id', $other->id)
                ->where('topMedicines.1.total_quantity', 15)
                ->where('stats.totalRevenue', 111)
            );
    }

    public function test_box_return_reduces_pieces_by_pack_size(): void
    {
        $this->makeSale(
            ['net_amount' => 135, 'refunded_amount' => 45, 'status' => Sale::STATUS_PARTIALLY_VOIDED],
            [['unit_type' => 'Box', 'qty' => 3, 'total' => 135, 'returned' => 1, 'refunded' => 45]]
        );

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->where('topMedicines.0.total_quantity', 20)
                ->where('topMedicines.0.total_revenue', 90)
                ->where('stats.totalRevenue', 90)
            );
    }

    public function test_period_filter_applies_to_every_card_except_revenue_trend(): void
    {
        $this->makeSale(['net_amount' => 10, 'created_at' => '2026-09-16 09:00:00'], [['qty' => 2, 'total' => 10]]);
        $this->makeSale(['net_amount' => 20, 'created_at' => '2026-09-14 09:00:00'], [['qty' => 4, 'total' => 20]]);
        $this->makeSale(['net_amount' => 40, 'created_at' => '2026-09-02 09:00:00'], [['qty' => 8, 'total' => 40]]);
        $this->makeSale(['net_amount' => 80, 'created_at' => '2026-08-20 09:00:00'], [['qty' => 16, 'total' => 80]]);

        $cases = [
            'stats_period=daily&stats_date=2026-09-16' => [10, 2],
            'stats_period=weekly&stats_date=2026-09-16' => [30, 6],
            'stats_period=monthly&stats_date=2026-09' => [70, 14],
            'stats_period=all' => [150, 30],
        ];

        foreach ($cases as $query => [$revenue, $pieces]) {
            $this->actingAsWithSession($this->admin)
                ->get('/admin-dashboard?'.$query)
                ->assertInertia(fn (Assert $page) => $page
                    ->where('stats.totalRevenue', $revenue)
                    ->where('topMedicines.0.total_quantity', $pieces)
                    ->where('charts.productBreakdown.values', [$revenue])
                    ->where('branchPerformance.0.total_revenue', $revenue)
                    ->where('charts.branchComparison.values.0', $revenue)
                    // Trend ignores the period: Aug 80, Sep 70.
                    ->where('charts.revenueTrend.values.4', 80)
                    ->where('charts.revenueTrend.values.5', 70)
                    ->where('charts.revenueTrend.labels.5', '09/2026')
                );
        }
    }

    public function test_weekly_label_is_monday_to_sunday(): void
    {
        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?stats_period=weekly&stats_date=2026-09-20')
            ->assertInertia(fn (Assert $page) => $page
                ->where('statsPeriodLabel', '14/09/2026 – 20/09/2026')
            );
    }

    public function test_blank_forms_merge_into_one_uncategorized_slice(): void
    {
        $nullForm = $this->makeProduct('A', null);
        $emptyForm = $this->makeProduct('B', '');
        $spaceForm = $this->makeProduct('C', '   ');

        $this->makeSale(['net_amount' => 60], [
            ['product' => $nullForm, 'qty' => 1, 'total' => 10],
            ['product' => $emptyForm, 'qty' => 1, 'total' => 20],
            ['product' => $spaceForm, 'qty' => 1, 'total' => 30],
        ]);
        $this->makeSale(['net_amount' => 5], [['qty' => 1, 'total' => 5]]);

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->where('charts.productBreakdown.labels', ['Uncategorized', 'Tablet'])
                ->where('charts.productBreakdown.values', [60, 5])
            );
    }

    public function test_staff_is_pinned_to_own_branch(): void
    {
        $this->makeSale(['branch_id' => $this->branchA->id, 'net_amount' => 10]);
        $this->makeSale(['branch_id' => $this->branchB->id, 'net_amount' => 99]);

        $this->actingAsWithSession($this->staff)
            ->get('/dashboard?branch_id='.$this->branchB->id)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.totalRevenue', 10)
                ->where('filters.branch_id', (string) $this->branchA->id)
                ->where('branches', [])
                ->where('branchPerformance', [])
                ->where('charts.branchComparison', null)
                ->where('canViewAllBranches', false)
                ->where('branchName', 'Main Branch')
            );
    }

    public function test_staff_without_branch_is_forbidden(): void
    {
        $this->actingAs($this->staff)
            ->withSession(['role_id' => 1])
            ->get('/dashboard')
            ->assertForbidden();
    }

    public function test_branch_selection_scopes_stats_but_branch_performance_lists_all_branches(): void
    {
        $this->makeSale(['branch_id' => $this->branchA->id, 'net_amount' => 10]);

        $this->actingAsWithSession($this->superadmin)
            ->get('/superadmin-dashboard?branch_id='.$this->branchB->id)
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.branch_id', (string) $this->branchB->id)
                ->where('branchName', 'Second Branch')
                ->where('stats.totalRevenue', 0)
                ->where('branchPerformance', [
                    ['id' => $this->branchA->id, 'branch_name' => 'Main Branch', 'total_revenue' => 10, 'transaction_count' => 1],
                    ['id' => $this->branchB->id, 'branch_name' => 'Second Branch', 'total_revenue' => 0, 'transaction_count' => 0],
                ])
                ->where('charts.branchComparison.labels', ['Main Branch', 'Second Branch'])
            );
    }

    public function test_invalid_branch_ids_fall_back_to_all(): void
    {
        $this->makeSale(['branch_id' => $this->branchA->id, 'net_amount' => 10]);
        $this->makeSale(['branch_id' => $this->branchB->id, 'net_amount' => 5]);
        $this->branchB->delete();

        foreach (['abc', '999999', (string) $this->branchB->id, '-1'] as $branchId) {
            $this->actingAsWithSession($this->admin)
                ->get('/admin-dashboard?branch_id='.$branchId)
                ->assertInertia(fn (Assert $page) => $page
                    ->where('filters.branch_id', 'all')
                    ->where('branchName', null)
                    ->where('stats.totalRevenue', 15)
                    ->has('branchPerformance', 1)
                );
        }
    }

    public function test_invalid_stats_dates_fall_back_instead_of_erroring(): void
    {
        $cases = [
            'stats_period=daily&stats_date=2026-13-45' => '2026-09-16',
            'stats_period=daily&stats_date=2026-02-30' => '2026-09-16',
            'stats_period=weekly&stats_date=abc' => '2026-09-16',
            'stats_period=monthly&stats_date=2026-13' => '2026-09',
            'stats_period=monthly&stats_date=2026-09-01' => '2026-09',
        ];

        foreach ($cases as $query => $expected) {
            $this->actingAsWithSession($this->admin)
                ->get('/admin-dashboard?'.$query)
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page->where('filters.stats_date', $expected));
        }

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?stats_period=yearly')
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.stats_period', 'all')
                ->where('filters.stats_date', null)
            );
    }

    public function test_monthly_filter_does_not_overflow_on_the_31st(): void
    {
        Carbon::setTestNow('2026-10-31 12:00:00');

        $this->makeSale(['net_amount' => 25, 'created_at' => '2026-02-10 09:00:00']);
        $this->makeSale(['net_amount' => 7, 'created_at' => '2026-03-10 09:00:00']);

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?stats_period=monthly&stats_date=2026-02')
            ->assertInertia(fn (Assert $page) => $page
                ->where('statsPeriodLabel', '02/2026')
                ->where('stats.totalRevenue', 25)
            );
    }
}
