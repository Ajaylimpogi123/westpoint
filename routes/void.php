<?php

use App\Http\Controllers\OrderHistoryController;
use Illuminate\Support\Facades\Route;
Route::middleware('auth')->group(function () {
Route::get('/history/{sale}/returnable', [OrderHistoryController::class, 'returnable'])
    ->name('history.returnable');
Route::post('/history/{sale}/void', [OrderHistoryController::class, 'storeVoid'])
    ->name('history.void');
});