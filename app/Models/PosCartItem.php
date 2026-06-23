<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosCartItem extends Model
{
    use HasFactory;

    protected $table = 'tbl_cart_items';

    protected $fillable = [
        'cart_id',
        'product_id',
        'unit_type',
        'quantity_sold',
    ];

    protected function casts(): array
    {
        return [
            'quantity_sold' => 'integer',
        ];
    }

    public function cart(): BelongsTo
    {
        return $this->belongsTo(PosCart::class, 'cart_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(MedicineProduct::class, 'product_id');
    }
}
