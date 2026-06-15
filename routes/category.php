<?php
use App\Http\Controllers\CategoryController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/category', [CategoryController::class, 'index'])->name('category.index');
    Route::post('/category', [CategoryController::class, 'store'])->name('category.store');
    Route::patch('/category/edit/{cat_id}', [CategoryController::class, 'update'])->name('category.update');
    Route::delete('/category/{cat_id}', [CategoryController::class, 'destroy'])->name('category.destroy');
});
