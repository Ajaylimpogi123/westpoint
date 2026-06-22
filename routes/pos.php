<?php

use App\Http\Controllers\PosController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/pos', [PosController::class, 'index'])
        ->name('pos.index');
    Route::get('/pos/search', [PosController::class, 'search'])
        ->name('pos.search');
    Route::post('/pos', [PosController::class, 'store'])
        ->name('pos.store');
});
