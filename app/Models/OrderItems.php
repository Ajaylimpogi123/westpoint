<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;


class OrderItems extends Model
{
    use HasFactory;
    
    protected $table = 'tbl_order_items';
    protected $primaryKey = 'oid_id';
    protected $fillable = [
        'od_id',           // Foreign key to orders table
        'pd_id',           // Foreign key to products table
        'oi_qty',
        'oi_price',
    ];

        public function orders()
    {
        return $this->belongs(Order::class, 'od_id', 'od_id');
    }

    public function products()
    {
        return $this->belongsTo(Product::class, 'pd_id', 'pd_id');
    }

}
