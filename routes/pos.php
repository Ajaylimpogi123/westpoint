<?php

use App\Http\Controllers\PosController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/pos', [PosController::class, 'index'])
        ->name('pos.index');
    Route::get('/pos/products/search', [PosController::class, 'searchProducts'])
        ->name('pos.products.search');
    Route::post('/pos', [PosController::class, 'store'])
        ->name('pos.store');

    Route::post('/pos/cart/items', [PosController::class, 'storeCartItem'])
        ->name('pos.cart.items.store');
    Route::patch('/pos/cart/items/{cartItem}', [PosController::class, 'updateCartItem'])
        ->name('pos.cart.items.update');
    Route::delete('/pos/cart/items/{cartItem}', [PosController::class, 'destroyCartItem'])
        ->name('pos.cart.items.destroy');
    Route::get('/pos/cart/checkout-preview', [PosController::class, 'previewCheckout'])
        ->name('pos.cart.checkout-preview');
});
