<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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
        'pieces_sold',
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
            'pieces_sold' => 'integer',
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

    /**
     * Pieces this line took off the shelf at checkout.
     *
     * Rows written before pieces_sold existed fall back to their batch
     * allocations (exact for split lines), then to the current pack size.
     */
    public function piecesSold(): int
    {
        if ($this->pieces_sold !== null) {
            return (int) $this->pieces_sold;
        }

        if ($this->relationLoaded('allocations') ? $this->allocations->isNotEmpty() : $this->allocations()->exists()) {
            return (int) $this->allocations()->sum('pieces');
        }

        $product = $this->product;

        if (! $product) {
            return (int) $this->quantity_sold;
        }

        return $product->toPieces((int) $this->quantity_sold, $this->unit_type);
    }

    /**
     * Pieces to restock when $quantity more units of this line are returned
     * on top of the $alreadyReturned units returned before. Pro rata on the
     * pieces actually sold, cumulative so a line returned in several parts
     * restocks exactly pieces_sold in total.
     */
    public function piecesForReturn(int $quantity, int $alreadyReturned): int
    {
        $sold = max((int) $this->quantity_sold, 1);
        $pieces = $this->piecesSold();

        $before = intdiv($pieces * $alreadyReturned, $sold);
        $after = intdiv($pieces * min($alreadyReturned + $quantity, $sold), $sold);

        return max($after - $before, 0);
    }

    public function remainingQuantity(): int
    {
        return max((int) $this->quantity_sold - (int) $this->returned_quantity, 0);
    }
}
