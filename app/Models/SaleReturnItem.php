<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleReturnItem extends Model
{
    protected $table = 'tbl_sale_return_items';
    protected $primaryKey = 'return_item_id';

    protected $fillable = [
        'return_id',
        'sale_item_id',
        'quantity_returned',
        'pieces_restocked',
        'refund_amount',
        'restocked_batches',
    ];

    protected function casts(): array
    {
        return [
            'quantity_returned' => 'integer',
            'pieces_restocked' => 'integer',
            'refund_amount' => 'decimal:2',
            'restocked_batches' => 'array',
        ];
    }

    public function return(): BelongsTo
    {
        return $this->belongsTo(SaleReturn::class, 'return_id', 'return_id');
    }

    public function saleItem(): BelongsTo
    {
        return $this->belongsTo(SaleItem::class, 'sale_item_id');
    }
}