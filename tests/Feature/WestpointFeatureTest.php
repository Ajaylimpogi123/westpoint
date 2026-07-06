<?php

namespace Tests\Feature;

use App\Models\PosCart;
use App\Models\PosCartItem;
use App\Models\ProductQty;
use App\Models\Sale;
use App\Models\StockTransfer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class WestpointFeatureTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_root_redirects_to_login(): void
    {
        $this->get('/')->assertRedirect('/login');
    }

    public function test_guest_cannot_access_protected_routes(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
        $this->get('/pos')->assertRedirect('/login');
        $this->get('/medicine-inventory')->assertRedirect('/login');
        $this->get('/branch-management')->assertRedirect('/login');
    }

    public function test_staff_can_access_core_pages(): void
    {
        $this->actingAsWithSession($this->staff)
            ->get('/dashboard')
            ->assertOk();

        $this->actingAsWithSession($this->staff)
            ->get('/pos')
            ->assertOk();

        $this->actingAsWithSession($this->staff)
            ->get('/medicine-inventory')
            ->assertOk();

        $this->actingAsWithSession($this->staff)
            ->get('/history')
            ->assertOk();

        $this->actingAsWithSession($this->staff)
            ->get('/stock-transfers')
            ->assertOk();
    }

    public function test_staff_cannot_access_branch_management(): void
    {
        $this->actingAsWithSession($this->staff)
            ->get('/branch-management')
            ->assertForbidden();
    }

    public function test_admin_cannot_access_branch_management(): void
    {
        $this->actingAsWithSession($this->admin)
            ->get('/branch-management')
            ->assertForbidden();
    }

    public function test_superadmin_can_access_branch_management(): void
    {
        $this->actingAsWithSession($this->superadmin)
            ->get('/branch-management')
            ->assertOk();
    }

    public function test_admin_dashboard_routes_render(): void
    {
        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard')
            ->assertOk();

        $this->actingAsWithSession($this->superadmin)
            ->get('/superadmin-dashboard')
            ->assertOk();
    }

    public function test_dashboard_filters_accept_valid_parameters(): void
    {
        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?stats_period=daily&stats_date=2026-07-01&payment_method=cash&branch_id='.$this->branchA->id)
            ->assertOk();

        $this->actingAsWithSession($this->admin)
            ->get('/admin-dashboard?stats_period=monthly&stats_date=2026-07')
            ->assertOk();
    }

    public function test_pos_product_search_returns_products(): void
    {
        $response = $this->actingAsWithSession($this->staff)
            ->getJson('/pos/products/search?search=Para');

        $response->assertOk()
            ->assertJsonPath('data.0.med_name', 'Paracetamol');
    }

    public function test_pos_cart_lifecycle_and_checkout(): void
    {
        $cartResponse = $this->actingAsWithSession($this->staff)
            ->postJson('/pos/cart/items', [
                'product_id' => $this->product->id,
                'unit_type' => 'Piece',
            ]);

        $cartResponse->assertOk();
        $cartId = $cartResponse->json('id');
        $itemId = $cartResponse->json('items.0.id');

        $this->actingAsWithSession($this->staff)
            ->patchJson("/pos/cart/items/{$itemId}", ['quantity_sold' => 2])
            ->assertOk()
            ->assertJsonPath('items.0.quantity', 2);

        $this->actingAsWithSession($this->staff)
            ->post('/pos', [
                'cart_id' => $cartId,
                'items' => [[
                    'product_id' => $this->product->id,
                    'unit_type' => 'Piece',
                    'quantity_sold' => 2,
                ]],
                'payment_method' => 'cash',
                'discount_amount' => 0,
                'amount_received' => 20,
                'customer_name' => 'Test Customer',
            ])
            ->assertRedirect(route('pos.index'));

        $this->assertDatabaseHas('tbl_sales', [
            'branch_id' => $this->branchA->id,
            'customer_name' => 'Test Customer',
            'payment_method' => 'cash',
            'net_amount' => 10.00,
        ]);

        $this->assertSame(98, (int) ProductQty::find($this->batch->id)->quantity);
    }

    public function test_pos_rejects_insufficient_payment(): void
    {
        $cart = PosCart::create([
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
        ]);

        PosCartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $this->product->id,
            'unit_type' => 'Piece',
            'quantity_sold' => 2,
        ]);

        $this->actingAsWithSession($this->staff)
            ->post('/pos', [
                'cart_id' => $cart->id,
                'items' => [[
                    'product_id' => $this->product->id,
                    'unit_type' => 'Piece',
                    'quantity_sold' => 2,
                ]],
                'payment_method' => 'cash',
                'discount_amount' => 0,
                'amount_received' => 1,
            ])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertDatabaseCount('tbl_sales', 0);
    }

    public function test_medicine_inventory_store_and_stock_in(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/medicine-inventory', [
                'med_name' => 'Ibuprofen',
                'dose' => '200mg',
                'form' => 'Tablet',
                'pack_size' => 20,
                'brand_name' => 'Advil',
                'retail_price' => 8,
                'wholesale_price' => 120,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('tbl_products', [
            'med_name' => 'Ibuprofen',
            'branch_id' => $this->branchA->id,
        ]);
    }

    public function test_staff_cannot_update_medicine_details(): void
    {
        $this->actingAsWithSession($this->staff)
            ->patch("/medicine-inventory/{$this->product->id}", [
                'med_name' => 'Changed Name',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_update_medicine_details(): void
    {
        $this->actingAsWithSession($this->admin)
            ->patch("/medicine-inventory/{$this->product->id}", [
                'med_name' => 'Paracetamol Updated',
                'dose' => '500mg',
                'form' => 'Tablet',
                'pack_size' => 10,
                'brand_name' => 'Bioflu',
                'retail_price' => 6,
                'wholesale_price' => 50,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('tbl_products', [
            'id' => $this->product->id,
            'med_name' => 'Paracetamol Updated',
        ]);
    }

    public function test_branch_management_crud(): void
    {
        $this->actingAsWithSession($this->superadmin)
            ->post('/branch-management', ['branch_name' => 'New Branch'])
            ->assertRedirect(route('branch-management.index'));

        $branch = \App\Models\Branch::where('branch_name', 'New Branch')->first();
        $this->assertNotNull($branch);

        $this->actingAsWithSession($this->superadmin)
            ->patch("/branch-management/{$branch->id}", ['branch_name' => 'Renamed Branch'])
            ->assertRedirect(route('branch-management.index'));

        $this->assertDatabaseHas('branches', ['branch_name' => 'Renamed Branch']);
    }

    public function test_staff_cannot_access_user_management(): void
    {
        $this->actingAsWithSession($this->staff)
            ->get('/user-management')
            ->assertForbidden();
    }

    public function test_admin_and_superadmin_can_access_user_management(): void
    {
        $this->actingAsWithSession($this->admin)
            ->get('/user-management')
            ->assertOk();

        $this->actingAsWithSession($this->superadmin)
            ->get('/user-management')
            ->assertOk();
    }

    public function test_register_requires_authentication(): void
    {
        $this->get('/register')->assertRedirect('/login');
    }

    public function test_admin_can_register_new_user(): void
    {
        $this->actingAsWithSession($this->admin)
            ->post('/register', [
                'name' => 'New Staff',
                'email' => 'newstaff@westpoint.test',
                'password' => 'password',
                'password_confirmation' => 'password',
                'branch_id' => $this->branchA->id,
                'role_id' => 1,
            ])
            ->assertRedirect(route('user-management.index'));

        $this->assertDatabaseHas('users', ['email' => 'newstaff@westpoint.test']);
    }

    public function test_stock_transfer_request_and_admin_approval(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/stock-transfers', [
                'from_branch_id' => $this->branchA->id,
                'to_branch_id' => $this->branchB->id,
                'priority' => 'normal',
                'reason' => 'Restock',
                'transfer_date' => now()->toDateString(),
                'items' => [[
                    'product_id' => $this->product->id,
                    'products_qty_id' => $this->batch->id,
                    'lot_number' => 'LOT-001',
                    'expiry' => $this->batch->expiry,
                    'quantity_requested' => 10,
                ]],
            ])
            ->assertRedirect(route('stock-transfers.index'));

        $transfer = StockTransfer::first();
        $this->assertNotNull($transfer);
        $this->assertSame('pending', $transfer->status);

        $this->actingAsWithSession($this->admin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertRedirect(route('stock-transfers.index'));

        $transfer->refresh();
        $this->assertSame('approved', $transfer->status);
        $this->assertSame(90, (int) ProductQty::find($this->batch->id)->quantity);
    }

    public function test_superadmin_cannot_approve_stock_transfer(): void
    {
        $transfer = StockTransfer::create([
            'transfer_no' => 'TRF-TEST-001',
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'requested_by' => $this->staff->id,
            'status' => 'pending',
            'priority' => 'normal',
            'transfer_date' => now()->toDateString(),
        ]);

        $this->actingAsWithSession($this->superadmin)
            ->post("/stock-transfers/{$transfer->id}/approve")
            ->assertForbidden();
    }

    public function test_order_history_shows_completed_sale(): void
    {
        Sale::create([
            'invoice_number' => 'POS-TEST-001',
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
            'customer_name' => 'History Customer',
            'gross_amount' => 10,
            'discount_amount' => 0,
            'net_amount' => 10,
            'payment_method' => 'cash',
        ]);

        $this->actingAsWithSession($this->staff)
            ->get('/history')
            ->assertOk();
    }

    public function test_user_without_branch_cannot_access_pos(): void
    {
        $user = \App\Models\User::factory()->create([
            'role_id' => 1,
            'branch_id' => null,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->withSession(['role_id' => 1])
            ->get('/pos')
            ->assertForbidden();
    }

    public function test_staff_cannot_access_register(): void
    {
        $this->actingAsWithSession($this->staff)
            ->get('/register')
            ->assertForbidden();

        $this->actingAsWithSession($this->staff)
            ->post('/register', [
                'name' => 'Unauthorized User',
                'email' => 'unauthorized@westpoint.test',
                'password' => 'password',
                'password_confirmation' => 'password',
                'branch_id' => $this->branchA->id,
                'role_id' => 3,
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('users', [
            'email' => 'unauthorized@westpoint.test',
        ]);
    }
}
