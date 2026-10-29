<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class SessionKeepAliveTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();
    }

    public function test_logged_in_user_can_keep_the_session_alive(): void
    {
        $this->actingAsWithSession($this->staff)
            ->getJson(route('session.keep-alive'))
            ->assertNoContent();
    }

    public function test_ended_session_is_reported_as_unauthenticated(): void
    {
        // The frontend turns this 401 into the "Session expired" prompt.
        $this->getJson(route('session.keep-alive'))->assertUnauthorized();
    }
}
