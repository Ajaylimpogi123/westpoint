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
        // List transfers (staff: own only | admin/superadmin: all) + new-request wizard
        Route::get('/',        [StockTransferController::class, 'index'])->name('index');

        // Submit new request
        Route::post('/',       [StockTransferController::class, 'store'])->name('store');
        // Medicines + transferable lots for a source branch (JSON)
        Route::get('/source-products', [StockTransferController::class, 'sourceProducts'])->name('source-products');

        // Old detail links: redirects to the list filtered to this transfer
        Route::get('/{stockTransfer}', [StockTransferController::class, 'show'])->name('show');

        // Cancel own pending request
        Route::post('/{stockTransfer}/cancel', [StockTransferController::class, 'cancel'])->name('cancel');

        // ── Admin only (role_id 2; superadmin can view, not approve) ──
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
//  POST   /stock-transfers                  → store
//  GET    /stock-transfers/source-products  → sourceProducts (JSON)
//  GET    /stock-transfers/{id}             → show (redirects to index)
//  POST   /stock-transfers/{id}/cancel      → cancel
//  POST   /stock-transfers/{id}/approve     → approve
//  POST   /stock-transfers/{id}/reject      → reject
//  GET    /stock-transfers/{id}/slip        → slip
// ============================================================