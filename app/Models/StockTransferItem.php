<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferItem extends Model
{
    protected $table = 'tbl_stock_transfer_items';

    protected $fillable = [
        'stock_transfer_id',
        'product_id',
        'products_qty_id',
        'lot_number',
        'expiry',
        'quantity_requested',
        'quantity_approved',
    ];

    protected $casts = [
        'expiry' => 'date',
    ];

    // ── Relationships ──────────────────────────────────────

    public function stockTransfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(MedicineProduct::class, 'product_id');  // ← fixed: was Product::class
    }

    public function productsQty(): BelongsTo
    {
        return $this->belongsTo(ProductQty::class, 'products_qty_id');
    }

    // ── Helpers ───────────────────────────────────────────

    /**
     * Effective quantity to move.
     * Uses approved qty if admin set one, otherwise falls back to requested.
     */
    public function getEffectiveQtyAttribute(): int
    {
        return $this->quantity_approved ?? $this->quantity_requested;
    }
}