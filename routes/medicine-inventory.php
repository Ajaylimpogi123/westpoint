<?php

use App\Http\Controllers\MedicineInventoryController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/medicine-inventory', [MedicineInventoryController::class, 'index'])
        ->name('medicine-inventory.index');
    Route::post('/medicine-inventory', [MedicineInventoryController::class, 'store'])
        ->name('medicine-inventory.store');
    Route::patch('/medicine-inventory/{id}', [MedicineInventoryController::class, 'update'])
        ->middleware('role:2,3')
        ->name('medicine-inventory.update');
    Route::delete('/medicine-inventory/{id}', [MedicineInventoryController::class, 'destroy'])
        ->name('medicine-inventory.destroy');
    Route::post('/medicine-inventory/stock', [MedicineInventoryController::class, 'storeStock'])
        ->name('medicine-inventory.store-stock');
    Route::patch('/medicine-inventory/batch/{id}', [MedicineInventoryController::class, 'updateBatch'])
        ->name('medicine-inventory.update-batch');
    Route::delete('/medicine-inventory/batch/{id}', [MedicineInventoryController::class, 'destroyBatch'])
        ->name('medicine-inventory.destroy-batch');
});
