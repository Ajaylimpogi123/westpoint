<?php

use App\Services\IdempotencyGuard;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Withdraw lapsed batches from sale. Runs just after midnight so a batch
// stops being dispensable on the first day it is expired, not the next time
// somebody happens to look at the inventory screen.
Schedule::command('inventory:expire-batches')
    ->dailyAt('00:15')
    ->withoutOverlapping();

Schedule::call(fn () => IdempotencyGuard::prune())
    ->daily()
    ->name('prune-idempotency-keys');
