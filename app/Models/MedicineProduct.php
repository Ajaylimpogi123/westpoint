<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicineProduct extends Model
{
    use HasFactory;

    protected $table = 'tbl_products';

    protected $fillable = [
        'med_name',
        'dose',
        'form',
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
        ];
    }

    public function quantities(): HasMany
    {
        return $this->hasMany(ProductQty::class, 'product_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'Active');
    }

    public function softDelete(): void
    {
        $this->update(['status' => 'Deleted']);
    }
}
