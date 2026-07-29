<?php

namespace App\Models;

use App\Enums\UnitType;
use App\Exceptions\InvalidPackSizeException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicineProduct extends Model
{
    use HasFactory;

    protected $table = 'tbl_products';

    protected $fillable = [
        'branch_id',
        'med_name',
        'dose',
        'form',
        'category',
        'is_generic',
        'pack_size',
        'brand_name',
        'retail_price',
        'stock_threshold',
        'wholesale_price',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'pack_size' => 'integer',
            'retail_price' => 'decimal:2',
            'wholesale_price' => 'decimal:2',
            'stock_threshold' => 'integer',
            'is_generic' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    /**
     * The single conversion point between a transacted unit and stored pieces.
     *
     * Every write path that touches products_qty.quantity must route its
     * quantity through here rather than multiplying inline — the Box branch
     * was previously duplicated across four controllers and omitted from a
     * fifth, which let box-denominated stock-outs deduct pieces.
     */
    public function toPieces(int $quantity, UnitType|string $unitType): int
    {
        $unit = $unitType instanceof UnitType
            ? $unitType
            : UnitType::fromInput($unitType);

        if (! $unit->isBox()) {
            return $quantity;
        }

        if (! $this->hasValidPackSize()) {
            throw InvalidPackSizeException::forProduct($this->med_name ?? 'This medicine');
        }

        return $quantity * (int) $this->pack_size;
    }

    /**
     * How many whole boxes the given piece count represents. Used for display
     * and for capping box-denominated inputs; never for computing stock.
     */
    public function toWholeBoxes(int $pieces): int
    {
        if (! $this->hasValidPackSize()) {
            return 0;
        }

        return intdiv(max($pieces, 0), (int) $this->pack_size);
    }

    public function hasValidPackSize(): bool
    {
        return (int) $this->pack_size >= 1;
    }

    public function batches(): HasMany
    {
        return $this->hasMany(ProductQty::class, 'product_id');
    }

    public function quantities(): HasMany
    {
        return $this->hasMany(ProductQty::class, 'product_id');
    }

        /**
     * productsQty — used by StockTransfer wizard eager load.
     * Same as quantities(); kept as a named alias so the controller
     * relationship string 'productsQty' resolves correctly.
     */
    public function productsQty(): HasMany
    {
        return $this->hasMany(ProductQty::class, 'product_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'Active');
    }

    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    public function scopeStockLevel($query, ?string $level)
    {
        if (! $level || $level === 'all') {
            return $query;
        }

        $stockSql = '(SELECT COALESCE(SUM(quantity), 0) FROM products_qty pq WHERE pq.product_id = tbl_products.id AND pq.status = \'Active\' AND pq.quantity > 0)';

        $thresholdSql = 'COALESCE(tbl_products.stock_threshold, 10)';

        return match ($level) {
            'out_of_stock' => $query->whereRaw("{$stockSql} = 0"),
            'low_stock' => $query
                ->whereRaw("{$stockSql} > 0")
                ->whereRaw("{$stockSql} <= {$thresholdSql}"),
            'in_stock' => $query->whereRaw("{$stockSql} > {$thresholdSql}"),
            'has_expired' => $query->whereHas('batches', function ($batchQuery) {
                $batchQuery
                    ->available()
                    ->whereNotNull('expiry')
                    ->whereDate('expiry', '<', now()->toDateString());
            }),
            'expiring_soon' => $query->whereHas('batches', function ($batchQuery) {
                $batchQuery
                    ->available()
                    ->whereNotNull('expiry')
                    ->whereDate('expiry', '>=', now()->toDateString())
                    ->whereDate('expiry', '<=', now()->addDays(30)->toDateString());
            }),
            default => $query,
        };
    }

    public function softDelete(): void
    {
        $this->update(['status' => 'Deleted']);
    }

    public function reactivate(): void
    {
        $this->update(['status' => 'Active']);
    }
}
