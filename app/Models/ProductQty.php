<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductQty extends Model
{
    use HasFactory;

    protected $table = 'products_qty';

    protected $fillable = [
        'product_id',
        'quantity',
        'branch_id',
        'status',
        'lot_number',
        'expiry',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'expiry' => 'date',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(MedicineProduct::class, 'product_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }
}
