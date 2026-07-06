<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_registration_screen_requires_admin_or_superadmin(): void
    {
        $this->get('/register')->assertRedirect('/login');

        $this->actingAsWithSession($this->staff)
            ->get('/register')
            ->assertForbidden();

        $this->actingAsWithSession($this->admin)
            ->get('/register')
            ->assertOk();
    }

    public function test_admin_can_register_new_user(): void
    {
        $response = $this->actingAsWithSession($this->admin)
            ->post('/register', [
                'name' => 'Test User',
                'email' => 'test@example.com',
                'password' => 'password',
                'password_confirmation' => 'password',
                'branch_id' => $this->branchA->id,
                'role_id' => 1,
            ]);

        $response->assertRedirect(route('user-management.index', absolute: false));
        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }
}
