<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quotation extends Model
{
    protected $table = 'tbl_quotation';

    protected $fillable = [
        'customer_id',
        'qt_no',
        'sid_no',
        'qt_date',
        'address',
        'delivery_type',
        'qt_remarks',
        'checked_by',
        'total_amount',
        'printed_by',
        'time_printed',
        'prepared_by',
        'date_signed',
        'received_by',
        'status',
    ];

    protected $casts = [
        'qt_date'      => 'date',
        'date_signed'  => 'date',
        'total_amount' => 'decimal:2',
    ];

    // ── Relationships ──────────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(BranchCustomer::class, 'customer_id', 'customer_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class, 'quotation_id')
                    ->orderBy('sort_order');
    }

    // ── Helpers ───────────────────────────────────────────

    /**
     * Recompute total_amount from all item amounts and save.
     */
    public function recalculateTotal(): void
    {
        $this->update([
            'total_amount' => $this->items()->sum('amount'),
        ]);
    }

    /**
     * Generate next QF number: QF-2026-00001
     */
    public static function generateQtNo(): string
    {
        $year = now()->year;

        $last = static::whereYear('created_at', $year)
            ->orderBy('id', 'desc')
            ->first();

        $sequence = $last
            ? (intval(substr($last->qt_no, -5)) + 1)
            : 1;

        return 'QF-' . $year . '-' . str_pad($sequence, 5, '0', STR_PAD_LEFT);
    }

    public function isDraft(): bool    { return $this->status === 'draft';     }
    public function isSent(): bool     { return $this->status === 'sent';      }
    public function isApproved(): bool { return $this->status === 'approved';  }
}