<?php
use App\Http\Controllers\MenuController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/menu', [MenuController::class, 'index'])->name('menu.index');
    Route::get('/menu/menu/{table_id}', [MenuController::class, 'menu'])->name('menu.menu');
    Route::post('/menu/menu/{table_id}', [MenuController::class, 'store'])->name('cart.store');
    Route::delete('/menu/{table_id}/cart/{cart}', [MenuController::class, 'destroy'])->name('cart.destroy');
    Route::patch('/menu/{table_id}/cart/{cart}', [MenuController::class, 'update'])->name('cart.update');
});
