<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasFactory;

    protected $table = 'tbl_sales';

    public const STATUS_COMPLETED = 'Completed';
    public const STATUS_PARTIALLY_VOIDED = 'Partially Voided';
    public const STATUS_VOIDED = 'Voided';

    protected $fillable = [
        'invoice_number',
        'branch_id',
        'user_id',
        'customer_name',
        'customer_id',
        'gross_amount',
        'discount_amount',
        'discount_type',
        'net_amount',
        'amount_received',
        'change_due',
        'status',
        'refunded_amount',
        'payment_method',
        'reference_number',
        'sales_remarks',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'amount_received' => 'decimal:2',
            'change_due' => 'decimal:2',
            'refunded_amount' => 'decimal:2',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(BranchCustomer::class, 'customer_id', 'customer_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class, 'sale_id');
    }

    public function returns(): HasMany
    {
        return $this->hasMany(SaleReturn::class, 'sale_id');
    }
}