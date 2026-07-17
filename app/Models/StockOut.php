<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StockOut extends Model
{
    use HasFactory;

    protected $table = 'tbl_stock_outs';
    protected $primaryKey = 'stock_out_id';

    protected $fillable = [
        'transaction_subtype',
        'branch_id',
        'patient_reference',
        'issued_by',
        'remarks',
        'delivered_to',
        'delivered_to_address',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function items()
    {
        return $this->hasMany(StockOutItem::class, 'stock_out_id', 'stock_out_id');
    }
}
