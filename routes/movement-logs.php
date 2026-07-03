<?php

use App\Http\Controllers\MovementLogController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/movement-logs/{movementLog}', [MovementLogController::class, 'show'])
        ->name('movement-logs.show');
});
