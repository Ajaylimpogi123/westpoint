<?php

namespace App\Models;

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
        'wholesale_price',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'pack_size' => 'integer',
            'retail_price' => 'decimal:2',
            'wholesale_price' => 'decimal:2',
            'is_generic' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
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

        $stockSql = '(SELECT COALESCE(SUM(quantity), 0) FROM products_qty pq WHERE pq.product_id = tbl_products.id AND pq.status != \'Deleted\')';

        return match ($level) {
            'out_of_stock' => $query->whereRaw("{$stockSql} = 0"),
            'low_stock' => $query
                ->whereRaw("{$stockSql} > 0")
                ->whereRaw("{$stockSql} <= (tbl_products.pack_size * 2)"),
            'in_stock' => $query->whereRaw("{$stockSql} > (tbl_products.pack_size * 2)"),
            'has_expired' => $query->whereHas('batches', function ($batchQuery) {
                $batchQuery
                    ->where('status', '!=', 'Deleted')
                    ->where('quantity', '>', 0)
                    ->whereNotNull('expiry')
                    ->whereDate('expiry', '<', now()->toDateString());
            }),
            'expiring_soon' => $query->whereHas('batches', function ($batchQuery) {
                $batchQuery
                    ->where('status', '!=', 'Deleted')
                    ->where('quantity', '>', 0)
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
}
