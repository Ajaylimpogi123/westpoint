<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItemAllocation extends Model
{
    use HasFactory;

    protected $table = 'tbl_sale_item_allocations';

    protected $fillable = [
        'sale_item_id',
        'products_qty_id',
        'pieces',
    ];

    protected function casts(): array
    {
        return [
            'pieces' => 'integer',
        ];
    }

    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class, 'sale_item_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ProductQty::class, 'products_qty_id');
    }
}
