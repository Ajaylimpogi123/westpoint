<?php

// ─────────────────────────────────────────────────────────────────────
// Add these inside your existing auth middleware group in routes/web.php
// ─────────────────────────────────────────────────────────────────────

use App\Http\Controllers\QuotationController;
use Illuminate\Support\Facades\Route;
Route::middleware(['auth'])->group(function () {

    Route::prefix('quotations')->name('quotations.')->group(function () {

        // Standard CRUD
        Route::get('/',                    [QuotationController::class, 'index'])   ->name('index');
        Route::get('/create',              [QuotationController::class, 'create'])  ->name('create');
        Route::post('/',                   [QuotationController::class, 'store'])   ->name('store');
        Route::get('/{quotation}',         [QuotationController::class, 'show'])    ->name('show');
        Route::get('/{quotation}/edit',    [QuotationController::class, 'edit'])    ->name('edit');
        Route::put('/{quotation}',         [QuotationController::class, 'update'])  ->name('update');
        Route::delete('/{quotation}',      [QuotationController::class, 'destroy']) ->name('destroy');

        // Print slip
        Route::get('/{quotation}/print',   [QuotationController::class, 'print'])   ->name('print');

        // Status workflow (send → approve / cancel)
        Route::patch('/{quotation}/status',[QuotationController::class, 'updateStatus'])->name('status');
    });

});

// ─────────────────────────────────────────────────────────────────────
// Route summary:
//
//  GET    /quotations                        → index
//  GET    /quotations/create                 → create
//  POST   /quotations                        → store
//  GET    /quotations/{id}                   → show
//  GET    /quotations/{id}/edit              → edit
//  PUT    /quotations/{id}                   → update
//  DELETE /quotations/{id}                   → destroy
//  GET    /quotations/{id}/print             → print (printable slip)
//  PATCH  /quotations/{id}/status            → updateStatus
// ─────────────────────────────────────────────────────────────────────