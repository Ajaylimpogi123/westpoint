<?php

namespace Tests\Feature;

use App\Models\InventoryMovementLog;
use App\Models\MedicineProduct;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class AddStockHistoryReportTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    private function addStock(MedicineProduct $medicine, array $overrides = []): void
    {
        $this->actingAsWithSession($this->admin)
            ->post('/medicine-inventory/stock', array_merge([
                'product_id' => $medicine->id,
                'boxes_received' => 2,
                'unit_type' => 'Box',
                'lot_number' => 'LOT-ADD',
                'expiry' => now()->addYear()->toDateString(),
                'shelf_number' => 'B-07',
            ], $overrides))
            ->assertSessionHasNoErrors();
    }

    public function test_report_lists_add_stock_entries_with_lot_details(): void
    {
        $this->addStock($this->product);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/add-stock-history')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/AddStockHistory')
                ->has('logs.data', 1)
                ->where('logs.data.0.medicine_name', 'Paracetamol')
                ->where('logs.data.0.branch_name', 'Main Branch')
                ->where('logs.data.0.lot_number', 'LOT-ADD')
                ->where('logs.data.0.shelf_number', 'B-07')
                ->where('logs.data.0.expiry', now()->addYear()->toDateString())
                ->where('logs.data.0.entered', '2 Box')
                ->where('logs.data.0.quantity', 20)
                ->where('logs.data.0.performed_by_name', 'Admin User')
                ->has('branches'));
    }

    public function test_report_filters_by_branch_and_search(): void
    {
        $other = MedicineProduct::create([
            'branch_id' => $this->branchB->id,
            'med_name' => 'Amlodipine',
            'pack_size' => 10,
            'retail_price' => 2,
            'wholesale_price' => 18,
            'status' => 'Active',
        ]);

        $this->addStock($this->product);
        $this->addStock($other, ['lot_number' => 'LOT-B']);

        $this->actingAsWithSession($this->superadmin)
            ->get('/reports/add-stock-history?branch_id=' . $this->branchB->id)
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('logs.data.0.medicine_name', 'Amlodipine')
                ->where('logs.data.0.branch_name', 'Second Branch'));

        $this->actingAsWithSession($this->superadmin)
            ->get('/reports/add-stock-history?search=parac')
            ->assertInertia(fn (Assert $page) => $page
                ->has('logs.data', 1)
                ->where('logs.data.0.medicine_name', 'Paracetamol'));
    }

    public function test_report_excludes_other_movement_types(): void
    {
        InventoryMovementLog::create([
            'branch_id' => $this->branchA->id,
            'movement_type' => InventoryMovementLog::TYPE_STOCK_IN,
            'reference_label' => 'Stock In #1',
            'pd_id' => $this->product->id,
            'medicine_name' => 'Paracetamol',
            'quantity' => 50,
        ]);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/add-stock-history')
            ->assertInertia(fn (Assert $page) => $page->has('logs.data', 0));
    }

    public function test_older_entries_without_metadata_fall_back_to_remarks(): void
    {
        InventoryMovementLog::create([
            'branch_id' => $this->branchA->id,
            'movement_type' => InventoryMovementLog::TYPE_ADD_STOCK,
            'reference_label' => "Medicine #{$this->product->id}",
            'pd_id' => $this->product->id,
            'medicine_name' => 'Paracetamol',
            'quantity' => 30,
            'remarks' => '3 Box(s) added manually.',
        ]);

        $this->actingAsWithSession($this->admin)
            ->get('/reports/add-stock-history')
            ->assertInertia(fn (Assert $page) => $page
                ->where('logs.data.0.entered', '3 Box(s)')
                ->where('logs.data.0.expiry', null));
    }

    public function test_staff_cannot_open_report(): void
    {
        $this->actingAsWithSession($this->staff)
            ->get('/reports/add-stock-history')
            ->assertForbidden();
    }
}
