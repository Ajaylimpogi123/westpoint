<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'returned_quantity',
        'price_used',
        'total_price',
        'discount_amount',
        'refunded_amount',
        'vat_exempt',
    ];

    protected function casts(): array
    {
        return [
            'quantity_sold' => 'integer',
            'returned_quantity' => 'integer',
            'price_used' => 'decimal:2',
            'total_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'refunded_amount' => 'decimal:2',
            'vat_exempt' => 'boolean',
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

    public function allocations(): HasMany
    {
        return $this->hasMany(SaleItemAllocation::class, 'sale_item_id');
    }

    public function returnLines(): HasMany
    {
        return $this->hasMany(SaleReturnItem::class, 'sale_item_id');
    }

    public function remainingQuantity(): int
    {
        return max((int) $this->quantity_sold - (int) $this->returned_quantity, 0);
    }
}