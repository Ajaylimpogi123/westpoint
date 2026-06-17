<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/login');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::get('/admin-dashboard', function () {
    return Inertia::render('AdminDashboard');
})->middleware(['auth', 'verified'])->name('admin-dashboard');

Route::get('/superadmin-dashboard', function () {
    return Inertia::render('SuperadminDashboard');
})->middleware(['auth', 'verified'])->name('superadmin-dashboard');

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