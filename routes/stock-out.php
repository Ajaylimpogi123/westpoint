<?php

use App\Http\Controllers\StockOutController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/stock-out/{stockOut}', [StockOutController::class, 'show'])->name('stock-out.show');
    Route::post('/stock-out', [StockOutController::class, 'store'])->name('stock-out.store');
});
