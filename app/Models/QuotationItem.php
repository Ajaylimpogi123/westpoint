<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationItem extends Model
{
    protected $table = 'tbl_quotation_items';

    protected $fillable = [
        'quotation_id',
        'qt_qty',
        'qt_unit',
        'qt_description',
        'lot_number',
        'expiry_date',
        'qt_unit_price',
        'amount',
        'sort_order',
    ];

    protected $casts = [
        'expiry_date'    => 'date',
        'qt_unit_price'  => 'decimal:2',
        'amount'         => 'decimal:2',
        'qt_qty'         => 'integer',
        'sort_order'     => 'integer',
    ];

    // ── Relationships ──────────────────────────────────────

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class, 'quotation_id');
    }

    // ── Boot — auto-compute amount on save ─────────────────

    protected static function boot(): void
    {
        parent::boot();

        // Automatically compute amount = qty × unit_price before every save
        static::saving(function ($item) {
            $item->amount = round($item->qt_qty * $item->qt_unit_price, 2);
        });

        // After save/delete, refresh parent total_amount
        static::saved(function ($item) {
            $item->quotation->recalculateTotal();
        });

        static::deleted(function ($item) {
            $item->quotation->recalculateTotal();
        });
    }
}