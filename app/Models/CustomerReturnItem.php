<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class CustomerReturnItem extends Model
{
    use HasFactory;

    protected $table = 'tbl_return_items';
    protected $primaryKey = 'item_id';

    protected $fillable = [
        'return_id',
        'pd_id',
        'batch_number',
        'expiry_date',
        'quantity_received',
        'pieces_received',
        'unit_type',
        'unit_price',
    ];

    protected function casts(): array
    {
        return [
            'quantity_received' => 'integer',
            'pieces_received' => 'integer',
            'expiry_date' => 'date',
            'unit_price' => 'decimal:2',
        ];
    }

    public function customerReturn()
    {
        return $this->belongsTo(CustomerReturn::class, 'return_id', 'return_id');
    }

    public function product()
    {
        return $this->belongsTo(MedicineProduct::class, 'pd_id');
    }
}