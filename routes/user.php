<?php

use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('register', [RegisteredUserController::class, 'create'])
        ->name('register');

    Route::post('register', [RegisteredUserController::class, 'store']);

    Route::get('/user-management', [UserController::class, 'index'])
        ->name('user-management.index');
});
