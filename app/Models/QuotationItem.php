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
        'qt_pcs_per_box',
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
        'qt_pcs_per_box' => 'integer',
        'sort_order'     => 'integer',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class, 'quotation_id');
    }

    protected static function boot(): void
    {
        parent::boot();

        static::saving(function ($item) {
            $item->amount = round($item->qt_qty * $item->qt_unit_price, 2);
        });

        static::saved(function ($item) {
            $item->quotation->recalculateTotal();
        });

        static::deleted(function ($item) {
            $item->quotation->recalculateTotal();
        });
    }
}