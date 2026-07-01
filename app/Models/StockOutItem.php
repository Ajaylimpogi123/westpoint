<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StockOutItem extends Model
{
    use HasFactory;

    protected $table = 'tbl_stock_out_items';
    protected $primaryKey = 'item_id';

    protected $fillable = [
        'stock_out_id',
        'pd_id',
        'lot_number',
        'quantity_deducted',
    ];

    protected function casts(): array
    {
        return [
            'quantity_deducted' => 'integer',
        ];
    }

    public function stockOut()
    {
        return $this->belongsTo(StockOut::class, 'stock_out_id', 'stock_out_id');
    }

    public function product()
    {
        return $this->belongsTo(MedicineProduct::class, 'pd_id');
    }
}
