<?php
use App\Http\Controllers\TableController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/table', [TableController::class, 'index'])->name('table.index');
    Route::post('/table', [TableController::class, 'store'])->name('table.store');
    Route::patch('/table/edit/{table_id}', [TableController::class, 'update'])->name('table.update');
    Route::delete('/table/{table_id}', [TableController::class, 'destroy'])->name('table.destroy');
});
