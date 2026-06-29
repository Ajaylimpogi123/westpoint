<?php

// ============================================================
// Add these routes inside your existing auth middleware group
// in routes/web.php
// ============================================================

use App\Http\Controllers\StockTransferController;
use Illuminate\Support\Facades\Route;
// All routes require authentication (via your existing auth middleware)
Route::middleware(['auth'])->group(function () {

    Route::prefix('stock-transfers')->name('stock-transfers.')->group(function () {

        // ── Secretary / Staff ────────────────────────────────
        // List transfers (staff: own only | admin: all)
        Route::get('/',        [StockTransferController::class, 'index'])->name('index');

        // Show new request form
        Route::get('/create',  [StockTransferController::class, 'create'])->name('create');

        // Submit new request
        Route::post('/',       [StockTransferController::class, 'store'])->name('store');

        // View single transfer
        Route::get('/{stockTransfer}', [StockTransferController::class, 'show'])->name('show');

        // Cancel own pending request
        Route::post('/{stockTransfer}/cancel', [StockTransferController::class, 'cancel'])->name('cancel');

        // ── Admin only ───────────────────────────────────────
        // (role check is inside the controller methods)

        // Approve a pending transfer
        Route::post('/{stockTransfer}/approve', [StockTransferController::class, 'approve'])->name('approve');

        // Reject a pending transfer
        Route::post('/{stockTransfer}/reject',  [StockTransferController::class, 'reject'])->name('reject');

        Route::get('/{stockTransfer}/slip', [StockTransferController::class, 'slip'])->name('slip');
    });

});

// ============================================================
// Route summary (for reference):
//
//  GET    /stock-transfers                  → index
//  GET    /stock-transfers/create           → create
//  POST   /stock-transfers                  → store
//  GET    /stock-transfers/{id}             → show
//  POST   /stock-transfers/{id}/cancel      → cancel
//  POST   /stock-transfers/{id}/approve     → approve
//  POST   /stock-transfers/{id}/reject      → reject
// ============================================================