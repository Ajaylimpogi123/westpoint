<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'tbl_product';
    protected $primaryKey = 'pd_id';

    protected $fillable = [
        'cat_id',
        'branch_id',
        'pd_name',
        'pd_description',
        'pd_price',
        'pd_qty',
        'pd_cost',
        'mark_up',
        'pd_mqty',
        'pd_image',
        'pd_status',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class, 'cat_id', 'cat_id');
    }

    public function carts()
    {
        return $this->hasMany(Cart::class, 'pd_id', 'pd_id');
    }

    public function stockInItems()
    {
        return $this->hasMany(StockInItem::class, 'pd_id', 'pd_id');
    }
}
