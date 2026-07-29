<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductQty extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'Active';
    public const STATUS_INACTIVE = 'Inactive';
    public const STATUS_EXPIRED = 'Expired';
    public const STATUS_DELETED = 'Deleted';

    protected $table = 'products_qty';

    protected $fillable = [
        'product_id',
        'quantity',
        'status',
        'lot_number',
        'expiry',
        'shelf_number',
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

    /**
     * Batches that hold stock and have not been removed.
     *
     * This is a reporting scope — it deliberately still includes expired
     * batches so the inventory screens can surface them. Anything that
     * consumes stock must use scopeDispensable() instead.
     */
    public function scopeAvailable($query)
    {
        return $query
            ->where('status', self::STATUS_ACTIVE)
            ->where('quantity', '>', 0);
    }

    /**
     * Batches that may actually be sold, dispensed, or transferred.
     *
     * A null expiry is treated as dispensable: the FEFO ordering already
     * sorts unknown expiries last, and refusing them would strand legacy
     * rows that predate expiry tracking.
     */
    public function scopeDispensable($query)
    {
        return $query->available()->notExpired();
    }

    public function scopeNotExpired($query)
    {
        return $query->where(function ($inner) {
            $inner
                ->whereNull('expiry')
                ->orWhereDate('expiry', '>=', now()->toDateString());
        });
    }

    public function scopeExpired($query)
    {
        return $query
            ->whereNotNull('expiry')
            ->whereDate('expiry', '<', now()->toDateString());
    }

    public function isExpired(): bool
    {
        return $this->expiry !== null && $this->expiry->isBefore(now()->startOfDay());
    }

    public function isDeleted(): bool
    {
        return $this->status === self::STATUS_DELETED;
    }
}
