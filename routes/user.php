<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'role:2,3'])->group(function () {
    Route::get('/user-management', [UserController::class, 'index'])
        ->name('user-management.index');

    Route::patch('/user-management/{id}', [UserController::class, 'update'])
        ->name('user-management.update');

    Route::patch('/user-management/{id}/toggle-status', [UserController::class, 'toggleStatus'])
        ->name('user-management.toggle-status');
});
