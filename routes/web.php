<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::get('/admin-dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('admin-dashboard');

Route::get('/superadmin-dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('superadmin-dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__ . '/auth.php';
require __DIR__ . '/category.php';
require __DIR__ . '/product.php';
require __DIR__ . '/table.php';
require __DIR__ . '/menu.php';
require __DIR__ . '/order.php';
require __DIR__ . '/history.php';
require __DIR__ . '/user.php';
require __DIR__ . '/branch-management.php';
require __DIR__ . '/medicine-inventory.php';
require __DIR__ . '/stock-in.php';
require __DIR__ . '/stock-out.php';
require __DIR__ . '/movement-logs.php';
require __DIR__ . '/pos.php';
require __DIR__ . '/stocktransfer.php';
require __DIR__ . '/quotation.php';
require __DIR__ . '/customer-management.php';