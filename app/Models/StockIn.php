<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StockIn extends Model
{
    use HasFactory;

    protected $table = 'tbl_stock_ins';
    protected $primaryKey = 'stock_in_id';

    protected $fillable = [
        'supplier_name',
        'delivery_date',
        'branch_id',
        'received_by'
    ];

    public function items()
    {
        return $this->hasMany(StockInItem::class, 'stock_in_id', 'stock_in_id');
    }
}
