<?php

use App\Http\Controllers\StockOutController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/stock-out/{stockOut}', [StockOutController::class, 'show'])->name('stock-out.show');
    Route::get('/stock-out/{stockOut}/receipt', [StockOutController::class, 'receipt'])->name('stock-out.receipt');
    Route::post('/stock-out', [StockOutController::class, 'store'])->name('stock-out.store');
    Route::post('/stock-out/{stockOut}/confirm-delivery', [StockOutController::class, 'confirmDelivery'])->name('stock-out.confirm-delivery');
});
