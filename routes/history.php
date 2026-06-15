<?php
use App\Http\Controllers\OrderHistoryController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/history', [OrderHistoryController::class, 'index'])->name('history.index');
});
