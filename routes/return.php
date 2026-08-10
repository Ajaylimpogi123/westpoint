<?php

use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CustomerReturnController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/customer-returns/{customerReturn}', [CustomerReturnController::class, 'show'])->name('customer-return.show');
    Route::get('/customer-returns/{customerReturn}/receipt', [CustomerReturnController::class, 'receipt'])->name('customer-return.receipt');
    Route::post('/customer-returns', [CustomerReturnController::class, 'store'])->name('customer-return.store');

    Route::get('/customers/for-branch', [CustomerController::class, 'forBranch'])->name('customer-management.for-branch');
    Route::post('/customers/quick', [CustomerController::class, 'quickStore'])->name('customer-management.quick-store');
   
});