<?php
use App\Http\Controllers\OrderController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::post('/order/{table_id}/place', [OrderController::class, 'store'])->name('order.place');
    Route::get('/order/{od_id}/print', [OrderController::class, 'print'])->name('order.print');
});
