<?php

use App\Http\Controllers\CustomerController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'role:1,2'])->group(function () {
    Route::get('/customer-management', [CustomerController::class, 'index'])
        ->name('customer-management.index');
    Route::post('/customer-management', [CustomerController::class, 'store'])
        ->name('customer-management.store');
});
