<?php

use App\Http\Controllers\StockInController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::post('/stock-in', [StockInController::class, 'store'])
        ->name('stock-in.store');
});
