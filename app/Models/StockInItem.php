<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StockInItem extends Model
{
    use HasFactory;

    protected $table = 'tbl_stock_in_items';
    protected $primaryKey = 'item_id';

    protected $fillable = [
        'stock_in_id',
        'pd_id',
        'batch_number',
        'expiry_date',
        'quantity_received',
        'unit_type'
    ];

    public function stockIn()
    {
        return $this->belongsTo(StockIn::class, 'stock_in_id', 'stock_in_id');
    }

    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
            'quantity_received' => 'integer',
        ];
    }

    public function product()
    {
        return $this->belongsTo(MedicineProduct::class, 'pd_id');
    }
}
