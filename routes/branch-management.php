<?php

use App\Http\Controllers\BranchController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/branch-management', [BranchController::class, 'index'])
        ->name('branch-management.index');
    Route::post('/branch-management', [BranchController::class, 'store'])
        ->name('branch-management.store');
    Route::patch('/branch-management/{id}', [BranchController::class, 'update'])
        ->name('branch-management.update');
    Route::delete('/branch-management/{id}', [BranchController::class, 'destroy'])
        ->name('branch-management.destroy');
});
