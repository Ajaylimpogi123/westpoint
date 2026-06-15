<?php
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/product', [ProductController::class, 'index'])->name('product.index');
    Route::get('/product/create', [ProductController::class, 'create'])->name('product.create');
    Route::post('/product', [ProductController::class, 'store'])->name('product.store');
    Route::get('/product/edit/{pd_id}', [ProductController::class, 'edit'])->name('product.edit');
    Route::post('/product/edit/{pd_id}', [ProductController::class, 'update'])->name('product.update');
    Route::delete('/product/{pd_id}', [ProductController::class, 'destroy'])->name('product.destroy');
});
