<?php

namespace Tests\Feature\Qa;

use App\Models\BranchCustomer;
use App\Models\ProductQty;
use App\Models\Quotation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

/**
 * Release QA pass: Quotation, Customers, User/Branch management, legacy routes.
 *
 * test_bug_* methods are regression tests for confirmed defects and are
 * EXPECTED TO FAIL until the defect is fixed. All other tests document
 * behaviour verified to work and must stay green.
 */
class QuotationCustomersFrontendQaTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected BranchCustomer $customerA;

    protected BranchCustomer $customerB;

    protected User $staffB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        $this->customerA = $this->makeCustomer($this->branchA->id, 'Ana', 'Alpha');
        $this->customerB = $this->makeCustomer($this->branchB->id, 'Ben', 'Bravo');

        $this->staffB = User::create([
            'name' => 'Staff B',
            'email' => 'staff-b@westpoint.test',
            'password' => Hash::make('password'),
            'role_id' => 1,
            'branch_id' => $this->branchB->id,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private function makeCustomer(int $branchId, string $first, string $last, string $status = 'active'): BranchCustomer
    {
        return BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $first,
            'last_name' => $last,
            'customer_type' => 'Regular',
            'status' => $status,
        ]);
    }

    private function quotationPayload(array $overrides = [], ?array $items = null): array
    {
        return array_merge([
            'customer_id' => $this->customerA->customer_id,
            'qt_date' => now()->toDateString(),
            'delivery_type' => 'pick-up',
            'items' => $items ?? [
                [
                    'qt_qty' => 3,
                    'qt_unit' => 'PIECE',
                    'qt_description' => 'Tablet - Paracetamol 500mg (Bioflu)',
                    'qt_unit_price' => 5.00,
                ],
            ],
        ], $overrides);
    }

    private function createQuotationAsStaff(): Quotation
    {
        $this->actingAsWithSession($this->staff)
            ->post('/quotations', $this->quotationPayload())
            ->assertRedirect(route('quotations.index'));

        return Quotation::query()->latest('id')->firstOrFail();
    }

    // ─────────────────────────────────────────────────────────────
    // Quotation — verified behaviour
    // ─────────────────────────────────────────────────────────────

    public function test_staff_creates_quotation_with_piece_and_box_lines_and_server_computes_total(): void
    {
        $response = $this->actingAsWithSession($this->staff)->post('/quotations', $this->quotationPayload([], [
            // retail per piece
            ['qt_qty' => 3, 'qt_unit' => 'PIECE', 'qt_pcs_per_box' => 99, 'qt_description' => 'Para', 'qt_unit_price' => 5.00, 'lot_number' => 'LOT-001'],
            // wholesale per box
            ['qt_qty' => 2, 'qt_unit' => 'BXS', 'qt_pcs_per_box' => 10, 'qt_description' => 'Para box', 'qt_unit_price' => 45.00],
        ]));

        $response->assertRedirect(route('quotations.index'))->assertSessionHasNoErrors();

        $quotation = Quotation::with('items')->sole();
        $this->assertMatchesRegularExpression('/^QF-'.now()->year.'-00001$/', $quotation->qt_no);
        $this->assertSame('draft', $quotation->status);
        $this->assertSame('105.00', (string) $quotation->total_amount); // 3*5 + 2*45

        [$piece, $box] = $quotation->items->all();
        $this->assertSame('15.00', (string) $piece->amount);
        $this->assertNull($piece->qt_pcs_per_box, 'pcs/box is dropped on piece lines');
        $this->assertNull($piece->lot_number, 'lot is intentionally not stored on quotations');
        $this->assertSame('90.00', (string) $box->amount);
        $this->assertSame(10, $box->qt_pcs_per_box);
    }

    public function test_box_line_requires_pcs_per_box(): void
    {
        $this->actingAsWithSession($this->staff)->post('/quotations', $this->quotationPayload([], [
            ['qt_qty' => 1, 'qt_unit' => 'BXS', 'qt_description' => 'Para box', 'qt_unit_price' => 45],
        ]))->assertSessionHasErrors('items.0.qt_pcs_per_box');

        $this->assertSame(0, Quotation::count());
    }

    public function test_quotation_validation_rejects_zero_negative_fractional_qty_and_empty_items(): void
    {
        foreach ([0, -1, 1.5] as $qty) {
            $this->actingAsWithSession($this->staff)->post('/quotations', $this->quotationPayload([], [
                ['qt_qty' => $qty, 'qt_unit' => 'PIECE', 'qt_description' => 'Para', 'qt_unit_price' => 5],
            ]))->assertSessionHasErrors('items.0.qt_qty');
        }

        $this->actingAsWithSession($this->staff)
            ->post('/quotations', $this->quotationPayload(['items' => []]))
            ->assertSessionHasErrors('items');

        $this->actingAsWithSession($this->staff)->post('/quotations', $this->quotationPayload([], [
            ['qt_qty' => 1, 'qt_unit' => 'PIECE', 'qt_description' => 'Para', 'qt_unit_price' => -1],
        ]))->assertSessionHasErrors('items.0.qt_unit_price');

        $this->assertSame(0, Quotation::count());
    }

    public function test_staff_cannot_quote_customer_of_other_branch_or_inactive_customer(): void
    {
        $this->actingAsWithSession($this->staff)
            ->post('/quotations', $this->quotationPayload(['customer_id' => $this->customerB->customer_id]))
            ->assertSessionHasErrors('customer_id');

        $inactive = $this->makeCustomer($this->branchA->id, 'Ina', 'Inactive', 'inactive');
        $this->actingAsWithSession($this->staff)
            ->post('/quotations', $this->quotationPayload(['customer_id' => $inactive->customer_id]))
            ->assertSessionHasErrors('customer_id');

        $this->assertSame(0, Quotation::count());
    }

    public function test_only_draft_quotations_can_be_updated_or_deleted(): void
    {
        $quotation = $this->createQuotationAsStaff();

        $this->actingAsWithSession($this->staff)
            ->put("/quotations/{$quotation->id}", $this->quotationPayload([], [
                ['qt_qty' => 4, 'qt_unit' => 'PIECE', 'qt_description' => 'Para', 'qt_unit_price' => 5],
            ]))->assertRedirect(route('quotations.show', $quotation));
        $this->assertSame('20.00', (string) $quotation->fresh()->total_amount);

        $this->actingAsWithSession($this->staff)
            ->patch("/quotations/{$quotation->id}/status", ['status' => 'sent']);
        $this->assertSame('sent', $quotation->fresh()->status);

        $this->actingAsWithSession($this->staff)
            ->put("/quotations/{$quotation->id}", $this->quotationPayload())
            ->assertSessionHasErrors('status');
        $this->actingAsWithSession($this->staff)
            ->delete("/quotations/{$quotation->id}")
            ->assertSessionHasErrors('status');

        $this->assertSame('20.00', (string) $quotation->fresh()->total_amount);
    }

    public function test_print_renders_and_records_printer(): void
    {
        $quotation = $this->createQuotationAsStaff();

        $this->actingAsWithSession($this->staff)
            ->get("/quotations/{$quotation->id}/print")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Quotation/Print')
                ->where('quotation.qt_no', $quotation->qt_no)
                ->has('quotation.items', 1));

        $this->assertSame('Staff User', $quotation->fresh()->printed_by);
    }

    // ─────────────────────────────────────────────────────────────
    // Quotation — confirmed defects (expected to FAIL until fixed)
    // ─────────────────────────────────────────────────────────────

    /** QUO-1 (fixed, qa-fix-batch-1): quotations are branch-scoped on read; other branch -> 404. */
    public function test_QUO1_staff_of_other_branch_cannot_open_or_list_quotation(): void
    {
        $quotation = $this->createQuotationAsStaff(); // branch A customer

        $this->actingAsWithSession($this->staffB)
            ->get("/quotations/{$quotation->id}")
            ->assertNotFound();

        $this->actingAsWithSession($this->staffB)->get('/quotations')
            ->assertInertia(fn (Assert $page) => $page->where('quotations.total', 0));
    }

    /** QUO-1b (fixed, qa-fix-batch-1): other-branch staff cannot delete a draft; 404. */
    public function test_QUO1b_staff_of_other_branch_cannot_delete_draft_quotation(): void
    {
        $quotation = $this->createQuotationAsStaff();

        $this->actingAsWithSession($this->staffB)
            ->delete("/quotations/{$quotation->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('tbl_quotation', ['id' => $quotation->id]);
    }

    /** QUO-2: updateStatus accepts any transition, incl. reviving a cancelled quotation. */
    public function test_bug_QUO2_cancelled_quotation_can_be_approved(): void
    {
        $quotation = $this->createQuotationAsStaff();
        $actor = $this->actingAsWithSession($this->staff);

        $actor->patch("/quotations/{$quotation->id}/status", ['status' => 'sent']);
        $actor->patch("/quotations/{$quotation->id}/status", ['status' => 'cancelled']);
        $this->assertSame('cancelled', $quotation->fresh()->status);

        $actor->patch("/quotations/{$quotation->id}/status", ['status' => 'approved']);

        $this->assertSame('cancelled', $quotation->fresh()->status, 'Cancelled is final ("This cannot be undone") but the server approved it');
    }

    /** QUO-3: medicine detail lists expired lots and picks one as primary (prefills its expiry). */
    public function test_bug_QUO3_medicine_detail_offers_expired_lot_as_primary(): void
    {
        ProductQty::create([
            'product_id' => $this->product->id,
            'quantity' => 50,
            'status' => 'Active', // not yet flipped by inventory:expire-batches
            'lot_number' => 'LOT-EXPIRED',
            'expiry' => now()->subDay()->toDateString(),
        ]);

        $response = $this->actingAsWithSession($this->staff)
            ->getJson("/quotations/medicines/{$this->product->id}")
            ->assertOk();

        $this->assertSame('LOT-001', $response->json('primary_lot.lot_number'));
        $this->assertNotContains('LOT-EXPIRED', collect($response->json('lots'))->pluck('lot_number')->all());
    }

    /** QUO-4: Q.F. numbers are derived from MAX(id) row, so deleting the latest draft reuses its number. */
    public function test_bug_QUO4_deleted_quotation_number_is_reused(): void
    {
        $this->createQuotationAsStaff();
        $second = $this->createQuotationAsStaff();
        $deletedNo = $second->qt_no;

        $this->actingAsWithSession($this->staff)->get("/quotations/{$second->id}/print")->assertOk();
        $this->actingAsWithSession($this->staff)->delete("/quotations/{$second->id}");
        $this->assertDatabaseMissing('tbl_quotation', ['id' => $second->id]);

        $third = $this->createQuotationAsStaff();

        $this->assertNotSame($deletedNo, $third->qt_no, "Printed-then-deleted {$deletedNo} was issued again");
    }

    /** QUO-5: no upper bound on qt_qty / price — over-limit input is a 500, not a validation error. */
    public function test_bug_QUO5_over_limit_quantity_is_server_error_not_validation_error(): void
    {
        $response = $this->actingAsWithSession($this->staff)->postJson('/quotations', $this->quotationPayload([], [
            ['qt_qty' => 3000000000, 'qt_unit' => 'PIECE', 'qt_description' => 'Para', 'qt_unit_price' => 5],
        ]));

        $this->assertSame(422, $response->status(), "Expected a validation error; got HTTP {$response->status()}");
        $this->assertSame(0, Quotation::count());
    }

    /** QUO-6 (fixed as a side effect of qa-fix-batch-1): index search's orWhere is not grouped, so the status filter is bypassed for Q.F. No. matches. */
    public function test_QUO6_status_filter_applies_when_searching_by_qf_number(): void
    {
        $this->createQuotationAsStaff(); // stays draft
        $sent = $this->createQuotationAsStaff();
        $this->actingAsWithSession($this->staff)->patch("/quotations/{$sent->id}/status", ['status' => 'sent']);

        $this->actingAsWithSession($this->staff)
            ->get('/quotations?search=QF-&status=sent')
            ->assertInertia(fn (Assert $page) => $page
                ->where('quotations.total', 1)
                ->where('quotations.data.0.status', 'sent'));
    }

    // ─────────────────────────────────────────────────────────────
    // Customers — verified behaviour
    // ─────────────────────────────────────────────────────────────

    public function test_staff_customer_endpoints_are_branch_scoped(): void
    {
        // for-branch: own branch ok, other branch forbidden
        $this->actingAsWithSession($this->staff)
            ->getJson('/customers/for-branch?branch_id='.$this->branchA->id)
            ->assertOk()
            ->assertJsonPath('customers.0.customer_id', $this->customerA->customer_id)
            ->assertJsonCount(1, 'customers');
        $this->actingAsWithSession($this->staff)
            ->getJson('/customers/for-branch?branch_id='.$this->branchB->id)
            ->assertForbidden();

        // quick-store ignores a spoofed branch_id and uses the session branch
        $this->actingAsWithSession($this->staff)->postJson('/customers/quick', [
            'first_name' => 'Quick', 'last_name' => 'Store', 'customer_type' => 'Regular',
            'branch_id' => $this->branchB->id,
        ])->assertCreated()->assertJsonPath('customer.branch_id', $this->branchA->id);

        // main store also uses the session branch
        $this->actingAsWithSession($this->staff)->post('/customer-management', [
            'first_name' => 'Main', 'last_name' => 'Store', 'customer_type' => 'Senior Citizen',
            'senior_id_number' => 'SC-1', 'pwd_id_number' => 'IGNORED', 'branch_id' => $this->branchB->id,
        ])->assertRedirect(route('customer-management.index'));
        $this->assertDatabaseHas('tbl_customers', [
            'first_name' => 'Main', 'branch_id' => $this->branchA->id, 'senior_id_number' => 'SC-1', 'pwd_id_number' => null,
        ]);

        // index lists only own branch
        $this->actingAsWithSession($this->staff)->get('/customer-management')
            ->assertInertia(fn (Assert $page) => $page->where('customers.total', 3)
                ->where('canFilterBranches', false));
    }

    public function test_customer_validation_and_update_scoping(): void
    {
        $this->actingAsWithSession($this->staff)->post('/customer-management', [
            'first_name' => '', 'last_name' => 'X', 'customer_type' => 'PWD', 'email' => 'not-an-email',
        ])->assertSessionHasErrors(['first_name', 'pwd_id_number', 'email']);

        $payload = ['first_name' => 'Ana', 'last_name' => 'Edited', 'customer_type' => 'Regular', 'status' => 'inactive'];

        $this->actingAsWithSession($this->staff)
            ->patch("/customer-management/{$this->customerA->customer_id}", $payload)
            ->assertRedirect(route('customer-management.index'));
        $this->assertDatabaseHas('tbl_customers', ['customer_id' => $this->customerA->customer_id, 'last_name' => 'Edited', 'status' => 'inactive']);

        $this->actingAsWithSession($this->staff)
            ->patch("/customer-management/{$this->customerB->customer_id}", $payload)
            ->assertForbidden();

        // admin is cross-branch and must give branch_id
        $this->actingAsWithSession($this->admin)
            ->patch("/customer-management/{$this->customerB->customer_id}", $payload)
            ->assertSessionHasErrors('branch_id');
    }

    /** CUS-1: soft-deleted branch passes `exists:branches,id`. */
    public function test_bug_CUS1_admin_can_register_customer_into_deleted_branch(): void
    {
        $this->branchB->delete();

        $this->actingAsWithSession($this->admin)->post('/customer-management', [
            'first_name' => 'Ghost', 'last_name' => 'Branch', 'customer_type' => 'Regular',
            'branch_id' => $this->branchB->id,
        ]);

        $this->assertDatabaseMissing('tbl_customers', ['first_name' => 'Ghost']);
    }

    // ─────────────────────────────────────────────────────────────
    // User & Branch management — verified behaviour
    // ─────────────────────────────────────────────────────────────

    public function test_management_routes_are_role_gated(): void
    {
        $this->actingAsWithSession($this->staff)->get('/user-management')->assertForbidden();
        $this->actingAsWithSession($this->staff)->get('/register')->assertForbidden();
        $this->actingAsWithSession($this->staff)->get('/branch-management')->assertForbidden();
        $this->actingAsWithSession($this->admin)->get('/branch-management')->assertForbidden();
        $this->actingAsWithSession($this->admin)->post('/branch-management', ['branch_name' => 'X'])->assertForbidden();

        $this->actingAsWithSession($this->admin)->get('/user-management')->assertOk();
        $this->actingAsWithSession($this->superadmin)->get('/branch-management')->assertOk();
    }

    public function test_guest_is_redirected_from_management_and_quotation_routes(): void
    {
        foreach (['/user-management', '/branch-management', '/customer-management', '/quotations'] as $uri) {
            $this->get($uri)->assertRedirect('/login');
        }
    }

    public function test_admin_cannot_promote_to_or_manage_superadmin_and_nobody_deactivates_self(): void
    {
        $this->actingAsWithSession($this->admin)->patch("/user-management/{$this->staff->id}", [
            'name' => 'Staff User', 'email' => 'staff@westpoint.test',
            'branch_id' => $this->branchA->id, 'role_id' => 3,
        ])->assertSessionHas('error');
        $this->assertSame(1, $this->staff->fresh()->role_id);

        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->superadmin->id}/toggle-status")->assertForbidden();
        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->admin->id}/toggle-status")->assertForbidden();

        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->staff->id}/toggle-status")->assertRedirect();
        $this->assertSame('inactive', $this->staff->fresh()->status);
    }

    public function test_deactivated_user_cannot_log_in(): void
    {
        $this->staff->update(['status' => 'inactive']);

        $this->post('/login', ['email' => 'staff@westpoint.test', 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_superadmin_branch_crud_and_soft_delete(): void
    {
        $su = $this->actingAsWithSession($this->superadmin);
        $su->post('/branch-management', ['branch_name' => 'Main Branch'])->assertSessionHasErrors('branch_name');
        $su->post('/branch-management', ['branch_name' => 'Third Branch'])->assertRedirect(route('branch-management.index'));
        $su->delete("/branch-management/{$this->branchB->id}")->assertRedirect(route('branch-management.index'));

        $this->assertSoftDeleted('branches', ['id' => $this->branchB->id]);
        $su->get('/branch-management')
            ->assertInertia(fn (Assert $page) => $page->where('branches.total', 2));
    }

    // ─────────────────────────────────────────────────────────────
    // User & Branch management — confirmed defects
    // ─────────────────────────────────────────────────────────────

    /** ADM-1 (fixed in qa-fix-batch-1): /register lets an Admin create a Superadmin (UserController::update blocks this, register does not). */
    public function test_ADM1_admin_cannot_register_a_superadmin(): void
    {
        $this->actingAsWithSession($this->admin)->post('/register', [
            'name' => 'Escalated', 'email' => 'escalated@westpoint.test',
            'password' => 'password123', 'password_confirmation' => 'password123',
            'branch_id' => $this->branchA->id, 'role_id' => 3,
        ]);

        $this->assertDatabaseMissing('users', ['email' => 'escalated@westpoint.test', 'role_id' => 3]);
    }

    /** ADM-2 (fixed in qa-fix-batch-1): deactivation only blocks new logins; an existing session keeps full access. */
    public function test_ADM2_deactivated_user_loses_access_with_existing_session(): void
    {
        $this->actingAsWithSession($this->admin)
            ->patch("/user-management/{$this->staff->id}/toggle-status");
        $this->assertSame('inactive', $this->staff->fresh()->status);

        // Fixed (qa-fix-batch-1): EnsureActiveUserSession logs the user out.
        $this->actingAsWithSession($this->staff->fresh())->get('/quotations')
            ->assertRedirect('/login')
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    /** ADM-3: user register/update accept a soft-deleted branch. */
    public function test_bug_ADM3_user_can_be_assigned_to_deleted_branch(): void
    {
        $this->branchB->delete();

        $this->actingAsWithSession($this->admin)->patch("/user-management/{$this->staff->id}", [
            'name' => 'Staff User', 'email' => 'staff@westpoint.test',
            'branch_id' => $this->branchB->id, 'role_id' => 1,
        ]);

        $this->assertSame($this->branchA->id, $this->staff->fresh()->branch_id);
    }

    /** ADM-4: deleting a branch leaves its users able to log in and work against the deleted branch. */
    public function test_bug_ADM4_deleting_branch_leaves_its_users_operational(): void
    {
        $this->actingAsWithSession($this->superadmin)
            ->delete("/branch-management/{$this->branchB->id}");
        $branchDeleted = $this->branchB->fresh()->trashed();

        auth()->logout();
        $this->flushSession();
        $this->post('/login', ['email' => 'staff-b@westpoint.test', 'password' => 'password']);

        $this->assertFalse(
            $branchDeleted && auth()->check(),
            'Branch B was soft-deleted while Staff B was assigned, and Staff B can still log in (session branch_id = deleted branch)'
        );
    }

    /** ADM-5: unique:branches,branch_name counts soft-deleted rows and there is no restore. */
    public function test_bug_ADM5_name_of_deleted_branch_can_never_be_reused(): void
    {
        $su = $this->actingAsWithSession($this->superadmin);
        $su->delete("/branch-management/{$this->branchB->id}");

        $su->post('/branch-management', ['branch_name' => 'Second Branch'])
            ->assertSessionHasNoErrors();
    }

    // ─────────────────────────────────────────────────────────────
    // Legacy restaurant-template routes
    // ─────────────────────────────────────────────────────────────

    /**
     * LEG-1: unlinked restaurant-POS routes were live for every role, incl.
     * writes. Fixed by owner decision D6 (qa-fix-batch-1): removed, 404.
     */
    public function test_LEG1_legacy_restaurant_routes_return_404(): void
    {
        foreach (['/table', '/menu', '/product', '/category', '/product/create', '/order'] as $uri) {
            $this->actingAsWithSession($this->staff)->get($uri)->assertNotFound();
        }

        $this->actingAsWithSession($this->staff)->post('/table', ['t_number' => 7])->assertNotFound();
        $this->assertFalse(\Illuminate\Support\Facades\DB::table('bs_table')->where('t_number', 7)->exists());
    }
}
