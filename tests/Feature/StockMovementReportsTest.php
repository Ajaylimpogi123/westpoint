<?php

namespace Tests\Feature;

use App\Models\MedicineProduct;
use App\Models\ProductQty;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class StockMovementReportsTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function stockIn(int $branchId, int $productId, string $unit, int $qty, int $pieces): void
    {
        $id = DB::table('tbl_stock_ins')->insertGetId([
            'supplier_name' => 'ABC Pharma',
            'delivery_date' => now()->toDateString(),
            'branch_id' => $branchId,
            'received_by' => 'Receiver',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('tbl_stock_in_items')->insert([
            'stock_in_id' => $id,
            'pd_id' => $productId,
            'batch_number' => 'LOT-IN',
            'expiry_date' => now()->addYear()->toDateString(),
            'quantity_received' => $qty,
            'pieces_received' => $pieces,
            'unit_type' => $unit,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function stockOut(string $subtype, bool $confirmed, string $unit, int $qty, int $pieces): void
    {
        $id = DB::table('tbl_stock_outs')->insertGetId([
            'transaction_subtype' => $subtype,
            'branch_id' => $this->branchA->id,
            'issued_by' => 'Issuer',
            'delivery_confirmed' => $confirmed,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('tbl_stock_out_items')->insert([
            'stock_out_id' => $id,
            'pd_id' => $this->product->id,
            'products_qty_id' => $this->batch->id,
            'lot_number' => 'LOT-001',
            'quantity_deducted' => $qty,
            'pieces_deducted' => $pieces,
            'unit_type' => $unit,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_stock_in_report_shows_branch_unit_pieces_and_totals(): void
    {
        $this->stockIn($this->branchA->id, $this->product->id, 'Box', 3, 30);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/stock-in')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/StockIn')
                ->has('items', 1)
                ->where('items.0.branch_name', 'Main Branch')
                ->where('items.0.unit_type', 'Box')
                ->where('items.0.quantity_received', 3)
                ->where('items.0.pieces_received', 30)
                ->where('items.0.dose', '500mg')
                ->where('totals.transactions', 1)
                ->where('totals.pieces', 30));
    }

    public function test_stock_in_report_filters_by_branch(): void
    {
        $other = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amlodipine',
            'pack_size' => 10,
            'retail_price' => 2,
            'wholesale_price' => 18,
            'status' => 'Active',
        ]);

        $this->stockIn($this->branchA->id, $this->product->id, 'Piece', 5, 5);
        $this->stockIn($this->branchB->id, $other->id, 'Piece', 7, 7);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/stock-in?branch_id=' . $this->branchB->id)
            ->assertInertia(fn (Assert $page) => $page
                ->has('items', 1)
                ->where('items.0.branch_name', 'Second Branch')
                ->where('totals.pieces', 7));
    }

    public function test_stock_out_report_separates_pending_deliveries_from_deducted_stock(): void
    {
        $this->stockOut('Returned to supplier', false, 'Box', 2, 20);
        $this->stockOut('Delivery to Customer', false, 'Piece', 4, 4);
        $this->stockOut('Delivery to Customer', true, 'piece', 3, 3);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/stock-out')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/StockOut')
                ->has('items', 3)
                ->where('totals.transactions', 3)
                ->where('totals.pieces', 23)
                ->where('totals.pending_pieces', 4)
                ->where('items', fn ($items) => collect($items)->pluck('status')->sort()->values()->all()
                    === ['Deducted', 'Delivered', 'Pending delivery'])
                ->where('items', fn ($items) => collect($items)->every(fn ($row) => $row['branch_name'] === 'Main Branch'))
                ->where('items', fn ($items) => collect($items)->pluck('unit_type')->contains('Piece')
                    && ! collect($items)->pluck('unit_type')->contains('piece')));
    }

    public function test_stock_out_report_filters_by_type(): void
    {
        $this->stockOut('Returned to supplier', false, 'Piece', 2, 2);
        $this->stockOut('Delivery to Customer', false, 'Piece', 4, 4);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/stock-out?status=Returned+to+supplier')
            ->assertInertia(fn (Assert $page) => $page
                ->has('items', 1)
                ->where('items.0.transaction_subtype', 'Returned to supplier')
                ->where('subtypes', fn ($subtypes) => collect($subtypes)->contains('Delivery to Customer')));
    }

    public function test_reports_are_admin_only(): void
    {
        $this->actingAsWithSession($this->staff)->get('/reports/stock-in')->assertForbidden();
        $this->actingAsWithSession($this->staff)->get('/reports/stock-out')->assertForbidden();
    }
}
