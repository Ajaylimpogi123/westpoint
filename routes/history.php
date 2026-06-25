<?php

use App\Http\Controllers\OrderHistoryController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/history', [OrderHistoryController::class, 'index'])->name('history.index');
    Route::get('/history/{sale}', [OrderHistoryController::class, 'show'])->name('history.show');
    Route::get('/history/{sale}/print', [OrderHistoryController::class, 'print'])->name('history.print');
});
