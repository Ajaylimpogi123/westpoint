<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SaleReturn extends Model
{
    protected $table = 'tbl_sale_returns';
    protected $primaryKey = 'return_id';

    protected $fillable = [
        'sale_id',
        'branch_id',
        'processed_by',
        'received_by',
        'reason',
        'total_refund',
    ];

    protected function casts(): array
    {
        return [
            'total_refund' => 'decimal:2',
        ];
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleReturnItem::class, 'return_id', 'return_id');
    }
}