<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferLog extends Model
{
    protected $table = 'tbl_stock_transfer_logs';

    // Only created_at; no updated_at on this table
    public $timestamps = false;

    protected $fillable = [
        'stock_transfer_id',
        'action',
        'performed_by',
        'note',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    // ──────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────

    public function stockTransfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class);
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    // ──────────────────────────────────────────
    // Boot — auto-set created_at on insert
    // ──────────────────────────────────────────

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function ($model) {
            $model->created_at = now();
        });
    }
}