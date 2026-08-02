<?php
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;
Route::middleware(['auth', 'role:2,3']) // swap for whatever guard you use on other back-office routes
    ->prefix('reports')
    ->name('reports.')
    ->group(function () {
        Route::get('/', [ReportController::class, 'index'])->name('index');

        // Sales
        Route::get('/sales-summary', [ReportController::class, 'salesSummary'])->name('sales-summary');
        Route::get('/sales-detail', [ReportController::class, 'salesDetail'])->name('sales-detail');
        Route::get('/sales-detail/export', [ReportController::class, 'exportSalesDetail'])->name('sales-detail.export');
        Route::get('/top-products', [ReportController::class, 'topProducts'])->name('top-products');
        Route::get('/sales-by-cashier', [ReportController::class, 'salesByCashier'])->name('sales-by-cashier');

        // Inventory
        Route::get('/stock-on-hand', [ReportController::class, 'stockOnHand'])->name('stock-on-hand');
        Route::get('/low-stock', [ReportController::class, 'lowStock'])->name('low-stock');
        Route::get('/expiry', [ReportController::class, 'expiry'])->name('expiry');

        // Movements
        Route::get('/stock-in', [ReportController::class, 'stockIn'])->name('stock-in');
        Route::get('/stock-out', [ReportController::class, 'stockOut'])->name('stock-out');
        Route::get('/stock-transfers', [ReportController::class, 'stockTransfers'])->name('stock-transfers');
        Route::get('/movement-ledger', [ReportController::class, 'movementLedger'])->name('movement-ledger');
    });