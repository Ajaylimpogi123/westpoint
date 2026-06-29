<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockTransfer extends Model
{
    protected $table = 'tbl_stock_transfers';

    protected $fillable = [
        'transfer_no',
        'from_branch_id',
        'to_branch_id',
        'requested_by',
        'approved_by',
        'status',
        'priority',
        'reason',
        'rejection_note',
        'needed_by',
        'transfer_date',
        'approved_at',
    ];

    protected $casts = [
        'transfer_date' => 'date',
        'needed_by'     => 'date',
        'approved_at'   => 'datetime',
    ];

    // ──────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────

    public function fromBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'from_branch_id');
    }

    public function toBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'to_branch_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockTransferItem::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(StockTransferLog::class)->latest('created_at');
    }

    // ──────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────

    /**
     * Generate next transfer number: TR-2026-00001
     */
    public static function generateTransferNo(): string
    {
        $year = now()->year;

        $last = static::whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $sequence = $last
            ? (intval(substr($last->transfer_no, -5)) + 1)
            : 1;

        return 'TR-' . $year . '-' . str_pad($sequence, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Check if this transfer can still be acted upon
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }
}