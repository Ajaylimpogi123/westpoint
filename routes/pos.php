<?php

use App\Http\Controllers\PosController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/pos', [PosController::class, 'index'])
        ->name('pos.index');
    Route::post('/pos', [PosController::class, 'store'])
        ->name('pos.store');
});
