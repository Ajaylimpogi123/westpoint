<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    use HasFactory;

    protected $table = 'tbl_sales_items';

    protected $fillable = [
        'sale_id',
        'product_id',
        'products_qty_id',
        'unit_type',
        'quantity_sold',
        'price_used',
        'total_price',
    ];

    protected function casts(): array
    {
        return [
            'quantity_sold' => 'integer',
            'price_used' => 'decimal:2',
            'total_price' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(MedicineProduct::class, 'product_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductQty::class, 'products_qty_id');
    }
}
