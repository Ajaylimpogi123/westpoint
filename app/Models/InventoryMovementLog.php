<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryMovementLog extends Model
{
    use HasFactory;

    public const TYPE_MEDICINE_ADDED = 'medicine_added';
    public const TYPE_MEDICINE_UPDATED = 'medicine_updated';
    public const TYPE_MEDICINE_DELETED = 'medicine_deleted';
    public const TYPE_STOCK_IN = 'stock_in';
    public const TYPE_STOCK_OUT = 'stock_out';
    public const TYPE_ADD_STOCK = 'add_stock';
    public const TYPE_BATCH_UPDATED = 'batch_updated';
    public const TYPE_BATCH_DELETED = 'batch_deleted';
    public const TYPE_MEDICINE_AUTO_DELETED = 'medicine_auto_deleted';
    public const TYPE_MEDICINE_REACTIVATED = 'medicine_reactivated';

    protected $table = 'tbl_inventory_movement_logs';
    protected $primaryKey = 'log_id';

    protected $fillable = [
        'branch_id',
        'movement_type',
        'reference_label',
        'reference_id',
        'pd_id',
        'medicine_name',
        'lot_number',
        'quantity',
        'performed_by',
        'remarks',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function performer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(MedicineProduct::class, 'pd_id');
    }
}
