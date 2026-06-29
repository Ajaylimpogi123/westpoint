<?php

use App\Http\Controllers\StockInController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/stock-in/{stockIn}', [StockInController::class, 'show'])
        ->name('stock-in.show');
    Route::post('/stock-in', [StockInController::class, 'store'])
        ->name('stock-in.store');
});
